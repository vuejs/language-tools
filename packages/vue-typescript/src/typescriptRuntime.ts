import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as upath from 'upath';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createVueDocument } from './vueDocument';
import { createVueDocuments } from './vueDocuments';
import { LanguageServiceHostBase, TypeScriptFeaturesRuntimeContext, VueCompilerOptions } from './types';
import * as localTypes from './utils/localTypes';
import type { TextRange } from '@volar/vue-code-gen';
import useHtmlPlugin from './plugins/html';
import usePugPlugin from './plugins/pug';

export interface VuePlugin {

    compileTemplate?(tmplate: string, lang: string): {
        html: string,
        htmlToTemplate(htmlStart: number, htmlEnd: number): { start: number, end: number } | undefined,
    } | undefined
}

export type TypeScriptRuntime = ReturnType<typeof createTypeScriptRuntime>;

export function createTypeScriptRuntime(options: {
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    vueCompilerOptions: VueCompilerOptions,
    getCssVBindRanges: (documrnt: TextDocument) => TextRange[],
    getCssClasses: (documrnt: TextDocument) => Record<string, TextRange[]>,
    vueHost: LanguageServiceHostBase,
    isTsPlugin?: boolean,
}) {

    const { typescript: ts } = options;

    const isVue2 = options.vueHost.getVueCompilationSettings?.().experimentalCompatMode === 2;

    let vueProjectVersion: string | undefined;
    let scriptContentVersion = 0; // only update by `<script>` / `<script setup>` / *.ts content
    let scriptProjectVersion = 0; // update by script LS virtual files / *.ts
    let templateProjectVersion = 0;
    let lastScriptProjectVersionWhenTemplateProjectVersionUpdate = -1;
    const vueDocuments = createVueDocuments();
    const templateScriptUpdateUris = new Set<string>();
    const initProgressCallback: ((p: number) => void)[] = [];
    const plugins = [
        useHtmlPlugin(),
        usePugPlugin(),
    ];
    const htmlLs = html.getLanguageService();
    const templateTsHost = options.vueCompilerOptions.experimentalDisableTemplateSupport ? undefined : createTsLsHost('template');
    const scriptTsHost = createTsLsHost('script');
    const templateTsLsRaw = templateTsHost ? ts.createLanguageService(templateTsHost) : undefined;
    const scriptTsLsRaw = ts.createLanguageService(scriptTsHost);

    if (templateTsHost && templateTsLsRaw) {
        shared.injectCacheLogicToLanguageServiceHost(ts, templateTsHost, templateTsLsRaw);
    }
    shared.injectCacheLogicToLanguageServiceHost(ts, scriptTsHost, scriptTsLsRaw);

    const localTypesScript = ts.ScriptSnapshot.fromString(localTypes.getTypesCode(isVue2));

    const context: TypeScriptFeaturesRuntimeContext = {
        vueHost: options.vueHost,
        vueDocuments,
        templateTsHost,
        scriptTsHost,
        templateTsLsRaw,
        scriptTsLsRaw,
        getTsLs: (lsType: 'template' | 'script') => lsType === 'template' ? templateTsLsRaw! : scriptTsLsRaw,
    };

    return {
        context,
        update,
        getScriptContentVersion: () => scriptContentVersion,
        dispose: () => {
            scriptTsLsRaw.dispose();
            templateTsLsRaw?.dispose();
        },
        onInitProgress(cb: (p: number) => void) {
            initProgressCallback.push(cb);
        },
        getLocalTypesFiles: (lsType: 'script' | 'template') => {
            const fileNames = getLocalTypesFiles(lsType);
            const code = localTypes.getTypesCode(isVue2);
            return {
                fileNames,
                code,
            };
        },
    };

    function getLocalTypesFiles(lsType: 'script' | 'template') {
        if (lsType === 'script')
            return [];
        return vueDocuments.getDirs().map(dir => upath.join(dir, localTypes.typesFileName));
    }
    function update(shouldUpdateTemplateScript: boolean) {
        const newVueProjectVersion = options.vueHost.getVueProjectVersion?.();
        if (newVueProjectVersion === undefined || newVueProjectVersion !== vueProjectVersion) {

            vueProjectVersion = newVueProjectVersion;

            const newFileUris = new Set([...options.vueHost.getScriptFileNames()].filter(file => file.endsWith('.vue')).map(shared.fsPathToUri));
            const removeUris: string[] = [];
            const addUris: string[] = [];
            const updateUris: string[] = [];

            for (const sourceFile of vueDocuments.getAll()) {
                const fileName = shared.uriToFsPath(sourceFile.uri);
                if (!newFileUris.has(sourceFile.uri) && !options.vueHost.fileExists?.(fileName)) {
                    // delete
                    removeUris.push(sourceFile.uri);
                }
                else {
                    // update
                    const newVersion = options.vueHost.getScriptVersion(fileName);
                    if (sourceFile.getVersion() !== newVersion) {
                        updateUris.push(sourceFile.uri);
                    }
                }
            }

            for (const newUri of newFileUris) {
                if (!vueDocuments.get(newUri)) {
                    // add
                    addUris.push(newUri);
                }
            }

            // if (tsFileChanged) {
            // 	scriptContentVersion++;
            // 	scriptProjectVersion++;
            // 	templateProjectVersion++;
            // 	// TODO: template global properties can't update by .d.ts definition
            // 	// wait for https://github.com/johnsoncodehk/volar/issues/455
            // 	// updates.length = 0;
            // 	// for (const fileName of oldFiles) {
            // 	// 	if (newFiles.has(fileName)) {
            // 	// 		if (fileName.endsWith('.vue')) {
            // 	// 			updates.push(fileName);
            // 	// 		}
            // 	// 	}
            // 	// }
            // }

            const finalUpdateUris = addUris.concat(updateUris);

            if (removeUris.length) {
                unsetSourceFiles(removeUris);
            }
            if (finalUpdateUris.length) {
                updateSourceFiles(finalUpdateUris, shouldUpdateTemplateScript)
            }
        }
        else if (shouldUpdateTemplateScript && templateScriptUpdateUris.size) {
            updateSourceFiles([], shouldUpdateTemplateScript)
        }
    }
    function createTsLsHost(lsType: 'template' | 'script') {

        const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
        const documentVersions = new WeakMap<TextDocument, string>();
        const tsHost: ts.LanguageServiceHost = {
            ...options.vueHost,
            fileExists: options.vueHost.fileExists
                ? fileName => {
                    // .vue.js -> .vue
                    // .vue.ts -> .vue
                    // .vue.d.ts (never)
                    const fileNameTrim = upath.trimExt(fileName);
                    if (fileNameTrim.endsWith('.vue')) {
                        const uri = shared.fsPathToUri(fileNameTrim);
                        const sourceFile = vueDocuments.get(uri);
                        if (!sourceFile) {
                            const fileExists = !!options.vueHost.fileExists?.(fileNameTrim);
                            if (fileExists) {
                                updateSourceFiles([uri], false); // create virtual files
                            }
                        }
                        return !!vueDocuments.fromEmbeddedDocumentUri(lsType, shared.fsPathToUri(fileName));
                    }
                    else {
                        return !!options.vueHost.fileExists?.(fileName);
                    }
                }
                : undefined,
            getProjectVersion: () => {
                return options.vueHost.getProjectVersion?.() + '-' + (lsType === 'template' ? templateProjectVersion : scriptProjectVersion).toString();
            },
            getScriptFileNames,
            getScriptVersion,
            getScriptSnapshot,
            readDirectory: (path, extensions, exclude, include, depth) => {
                const result = options.vueHost.readDirectory?.(path, extensions, exclude, include, depth) ?? [];
                for (const uri of vueDocuments.getUris()) {
                    const vuePath = shared.uriToFsPath(uri);
                    const vuePath2 = upath.join(path, upath.basename(vuePath));
                    if (upath.relative(path.toLowerCase(), vuePath.toLowerCase()).startsWith('..')) {
                        continue;
                    }
                    if (!depth && vuePath.toLowerCase() === vuePath2.toLowerCase()) {
                        result.push(vuePath2);
                    }
                    else if (depth) {
                        result.push(vuePath2); // TODO: depth num
                    }
                }
                return result;
            },
            getScriptKind(fileName) {
                switch (upath.extname(fileName)) {
                    case '.vue': return ts.ScriptKind.TSX; // can't use External, Unknown
                    case '.js': return ts.ScriptKind.JS;
                    case '.jsx': return ts.ScriptKind.JSX;
                    case '.ts': return ts.ScriptKind.TS;
                    case '.tsx': return ts.ScriptKind.TSX;
                    case '.json': return ts.ScriptKind.JSON;
                    default: return ts.ScriptKind.Unknown;
                }
            },
        };

        if (lsType === 'template') {
            tsHost.getCompilationSettings = () => ({
                ...options.vueHost.getCompilationSettings(),
                jsx: ts.JsxEmit.Preserve,
            });
        }

        return tsHost;

        function getScriptFileNames() {
            const tsFileNames = getLocalTypesFiles(lsType);

            for (const sourceMap of vueDocuments.getEmbeddeds(lsType)) {
                tsFileNames.push(shared.uriToFsPath(sourceMap.mappedDocument.uri)); // virtual .ts
            }
            for (const fileName of options.vueHost.getScriptFileNames()) {
                if (options.isTsPlugin) {
                    tsFileNames.push(fileName); // .vue + .ts
                }
                else if (!fileName.endsWith('.vue')) {
                    tsFileNames.push(fileName); // .ts
                }
            }
            return tsFileNames;
        }
        function getScriptVersion(fileName: string) {
            const uri = shared.fsPathToUri(fileName);
            const basename = upath.basename(fileName);
            if (basename === localTypes.typesFileName) {
                return '';
            }
            let sourceMap = vueDocuments.fromEmbeddedDocumentUri(lsType, uri);
            if (sourceMap) {
                if (documentVersions.has(sourceMap.mappedDocument)) {
                    return documentVersions.get(sourceMap.mappedDocument)!;
                }
                else {
                    const version = ts.sys.createHash?.(sourceMap.mappedDocument.getText()) ?? sourceMap.mappedDocument.getText();
                    documentVersions.set(sourceMap.mappedDocument, version);
                    return version;
                }
            }
            return options.vueHost.getScriptVersion(fileName);
        }
        function getScriptSnapshot(fileName: string) {
            const version = getScriptVersion(fileName);
            const cache = scriptSnapshots.get(fileName);
            if (cache && cache[0] === version) {
                return cache[1];
            }
            const basename = upath.basename(fileName);
            if (basename === localTypes.typesFileName) {
                return localTypesScript;
            }
            const uri = shared.fsPathToUri(fileName);
            const sourceMap = vueDocuments.fromEmbeddedDocumentUri(lsType, uri);
            if (sourceMap) {
                const text = sourceMap.mappedDocument.getText();
                const snapshot = ts.ScriptSnapshot.fromString(text);
                scriptSnapshots.set(fileName, [version, snapshot]);
                return snapshot;
            }
            let tsScript = options.vueHost.getScriptSnapshot(fileName);
            if (tsScript) {
                if (lsType === 'template' && basename === 'runtime-dom.d.ts') {
                    // allow arbitrary attributes
                    let tsScriptText = tsScript.getText(0, tsScript.getLength());
                    tsScriptText = tsScriptText.replace('type ReservedProps = {', 'type ReservedProps = { [name: string]: any')
                    tsScript = ts.ScriptSnapshot.fromString(tsScriptText);
                }
                scriptSnapshots.set(fileName, [version, tsScript]);
                return tsScript;
            }
        }
    }
    function updateSourceFiles(uris: string[], shouldUpdateTemplateScript: boolean) {

        let vueScriptContentsUpdate = false;
        let vueScriptsUpdated = false;
        let templateScriptUpdated = false;

        if (shouldUpdateTemplateScript) {
            for (const cb of initProgressCallback) {
                cb(0);
            }
        }
        for (const uri of uris) {

            const fileName = shared.uriToFsPath(uri);
            const sourceFile = vueDocuments.get(uri);
            const scriptSnapshot = options.vueHost.getScriptSnapshot(fileName);

            if (!scriptSnapshot) {
                continue;
            }

            const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
            const scriptVersion = options.vueHost.getScriptVersion(fileName);

            if (!sourceFile) {
                vueDocuments.set(uri, createVueDocument(
                    uri,
                    scriptText,
                    scriptVersion,
                    htmlLs,
                    plugins,
                    options.vueCompilerOptions,
                    options.typescript,
                    options.getCssVBindRanges,
                    options.getCssClasses,
                ));
                vueScriptContentsUpdate = true;
                vueScriptsUpdated = true;
            }
            else {
                const updates = sourceFile.update(scriptText, scriptVersion);
                if (updates.scriptContentUpdated) {
                    vueScriptContentsUpdate = true;
                }
                if (updates.scriptUpdated) {
                    vueScriptsUpdated = true;
                }
                if (updates.templateScriptUpdated) {
                    templateScriptUpdated = true;
                }
            }
            templateScriptUpdateUris.add(uri);
        }
        if (vueScriptContentsUpdate) {
            scriptContentVersion++;
        }
        if (vueScriptsUpdated) {
            scriptProjectVersion++;
            templateProjectVersion++;
        }
        if (shouldUpdateTemplateScript && lastScriptProjectVersionWhenTemplateProjectVersionUpdate !== scriptContentVersion) {
            lastScriptProjectVersionWhenTemplateProjectVersionUpdate = scriptContentVersion;
            let currentNums = 0;
            for (const uri of templateScriptUpdateUris) {
                if (templateTsLsRaw && templateTsHost && vueDocuments.get(uri)?.updateTemplateScript(templateTsLsRaw, templateTsHost)) {
                    templateScriptUpdated = true;
                }
                currentNums++;
                for (const cb of initProgressCallback) {
                    cb(currentNums / templateScriptUpdateUris.size);
                }
            }
            templateScriptUpdateUris.clear();
            for (const cb of initProgressCallback) {
                cb(1);
            }
            initProgressCallback.length = 0;
        }
        if (templateScriptUpdated) {
            templateProjectVersion++;
        }
    }
    function unsetSourceFiles(uris: string[]) {
        let updated = false;
        for (const uri of uris) {
            if (vueDocuments.delete(uri)) {
                updated = true;
            }
        }
        if (updated) {
            scriptContentVersion++;
            scriptProjectVersion++;
            templateProjectVersion++;
        }
    }
}
