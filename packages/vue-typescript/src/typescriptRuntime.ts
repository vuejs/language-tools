import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as upath from 'upath';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as ts2 from 'vscode-typescript-languageservice';
import { BasicRuntimeContext } from '.';
import { createVueDocument } from './sourceFile';
import { createVueDocuments } from './sourceFiles';
import { LanguageServiceHostBase, TypeScriptFeaturesRuntimeContext } from './types';
import * as localTypes from './utils/localTypes';

export function createTypeScriptRuntime(
    options: {
        typescript: typeof import('typescript/lib/tsserverlibrary'),
        htmlLs: html.LanguageService,
        compileTemplate: BasicRuntimeContext['compileTemplate'],
        compilerOptions: BasicRuntimeContext['compilerOptions'],
        getCssVBindRanges: BasicRuntimeContext['getCssVBindRanges'],
        getCssClasses: BasicRuntimeContext['getCssClasses'],
    },
    vueHost: LanguageServiceHostBase,
    isTsPlugin = false,
) {

    const { typescript: ts } = options;

    const isVue2 = vueHost.getVueCompilationSettings?.().experimentalCompatMode === 2;

    let vueProjectVersion: string | undefined;
    let scriptContentVersion = 0; // only update by `<script>` / `<script setup>` / *.ts content
    let scriptProjectVersion = 0; // update by script LS virtual files / *.ts
    let templateProjectVersion = 0;
    let lastScriptProjectVersionWhenTemplateProjectVersionUpdate = -1;
    const documents = shared.createPathMap<TextDocument>(); // TODO: remove this
    const vueDocuments = createVueDocuments();
    const templateScriptUpdateUris = new Set<string>();
    const initProgressCallback: ((p: number) => void)[] = [];

    const templateTsHost = createTsLsHost('template');
    const scriptTsHost = createTsLsHost('script');
    const templateTsLsRaw = ts.createLanguageService(templateTsHost);
    const scriptTsLsRaw = ts.createLanguageService(scriptTsHost);

    shared.injectCacheLogicToLanguageServiceHost(ts, templateTsHost, templateTsLsRaw);
    shared.injectCacheLogicToLanguageServiceHost(ts, scriptTsHost, scriptTsLsRaw);

    const templateTsLs = ts2.createLanguageService(ts, templateTsHost, templateTsLsRaw);
    const scriptTsLs = ts2.createLanguageService(ts, scriptTsHost, scriptTsLsRaw);
    const localTypesScript = ts.ScriptSnapshot.fromString(localTypes.getTypesCode(isVue2));
    const compilerHost = ts.createCompilerHost(vueHost.getCompilationSettings());
    const documentContext: html.DocumentContext = {
        resolveReference(ref: string, base: string) {

            const isUri = base.indexOf('://') >= 0;
            const resolveResult = ts.resolveModuleName(
                ref,
                isUri ? shared.uriToFsPath(base) : base,
                vueHost.getCompilationSettings(),
                compilerHost,
            );
            const failedLookupLocations: string[] = (resolveResult as any).failedLookupLocations;
            const dirs = new Set<string>();

            const fileExists = vueHost.fileExists ?? ts.sys.fileExists;
            const directoryExists = vueHost.directoryExists ?? ts.sys.directoryExists;

            for (const failed of failedLookupLocations) {
                let path = failed;
                const fileName = upath.basename(path);
                if (fileName === 'index.d.ts' || fileName === '*.d.ts') {
                    dirs.add(upath.dirname(path));
                }
                if (path.endsWith('.d.ts')) {
                    path = upath.removeExt(upath.removeExt(path, '.ts'), '.d');
                }
                else {
                    continue;
                }
                if (fileExists(path)) {
                    return isUri ? shared.fsPathToUri(path) : path;
                }
            }
            for (const dir of dirs) {
                if (directoryExists(dir)) {
                    return isUri ? shared.fsPathToUri(dir) : dir;
                }
            }

            return undefined;
        },
    }

    const context: TypeScriptFeaturesRuntimeContext = {
        vueHost,
        vueDocuments,
        templateTsHost,
        scriptTsHost,
        templateTsLsRaw,
        scriptTsLsRaw,
        templateTsLs,
        scriptTsLs,
        documentContext,
        getTsLs: (lsType: 'template' | 'script') => lsType === 'template' ? templateTsLs : scriptTsLs,
    };

    return {
        context,
        apiHook,
        update,
        getHostDocument,
        getScriptContentVersion: () => scriptContentVersion,
        dispose: () => {
            scriptTsLs.dispose();
            templateTsLs.dispose();
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
    function apiHook<T extends (...args: any) => any>(
        api: T,
        shouldUpdateTemplateScript: boolean | ((...args: Parameters<T>) => boolean) = true,
    ) {
        const handler = {
            apply(target: (...args: any) => any, thisArg: any, argumentsList: Parameters<T>) {
                const _shouldUpdateTemplateScript = typeof shouldUpdateTemplateScript === 'boolean' ? shouldUpdateTemplateScript : shouldUpdateTemplateScript.apply(null, argumentsList);
                update(_shouldUpdateTemplateScript);
                return target.apply(thisArg, argumentsList);
            }
        };
        return new Proxy<T>(api, handler);
    }
    function update(shouldUpdateTemplateScript: boolean) {
        const newVueProjectVersion = vueHost.getVueProjectVersion?.();
        if (newVueProjectVersion === undefined || newVueProjectVersion !== vueProjectVersion) {

            vueProjectVersion = newVueProjectVersion;

            const newFileUris = new Set([...vueHost.getScriptFileNames()].filter(file => file.endsWith('.vue')).map(shared.fsPathToUri));
            const removeUris: string[] = [];
            const addUris: string[] = [];
            const updateUris: string[] = [];

            for (const sourceFile of vueDocuments.getAll()) {
                const fileName = shared.uriToFsPath(sourceFile.uri);
                if (!newFileUris.has(sourceFile.uri) && !vueHost.fileExists?.(fileName)) {
                    // delete
                    removeUris.push(sourceFile.uri);
                }
                else {
                    // update
                    const newVersion = vueHost.getScriptVersion(fileName);
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
        const tsHost: ts2.LanguageServiceHost = {
            ...vueHost,
            fileExists: vueHost.fileExists
                ? fileName => {
                    // .vue.js -> .vue
                    // .vue.ts -> .vue
                    // .vue.d.ts (never)
                    const fileNameTrim = upath.trimExt(fileName);
                    if (fileNameTrim.endsWith('.vue')) {
                        const uri = shared.fsPathToUri(fileNameTrim);
                        const sourceFile = vueDocuments.get(uri);
                        if (!sourceFile) {
                            const fileExists = !!vueHost.fileExists?.(fileNameTrim);
                            if (fileExists) {
                                updateSourceFiles([uri], false); // create virtual files
                            }
                        }
                        return !!vueDocuments.fromEmbeddedDocumentUri(lsType, shared.fsPathToUri(fileName));
                    }
                    else {
                        return !!vueHost.fileExists?.(fileName);
                    }
                }
                : undefined,
            getProjectVersion: () => {
                return vueHost.getProjectVersion?.() + '-' + (lsType === 'template' ? templateProjectVersion : scriptProjectVersion).toString();
            },
            getScriptFileNames,
            getScriptVersion,
            getScriptSnapshot,
            readDirectory: (path, extensions, exclude, include, depth) => {
                const result = vueHost.readDirectory?.(path, extensions, exclude, include, depth) ?? [];
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
                ...vueHost.getCompilationSettings(),
                jsx: ts.JsxEmit.Preserve,
            });
        }

        return tsHost;

        function getScriptFileNames() {
            const tsFileNames = getLocalTypesFiles(lsType);

            for (const sourceMap of vueDocuments.getEmbeddeds(lsType)) {
                tsFileNames.push(shared.uriToFsPath(sourceMap.mappedDocument.uri)); // virtual .ts
            }
            for (const fileName of vueHost.getScriptFileNames()) {
                if (isTsPlugin) {
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
                return '0';
            }
            let sourceMap = vueDocuments.fromEmbeddedDocumentUri(lsType, uri);
            if (sourceMap) {
                return sourceMap.mappedDocument.version.toString();
            }
            return vueHost.getScriptVersion(fileName);
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
            let tsScript = vueHost.getScriptSnapshot(fileName);
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
    function getHostDocument(uri: string): TextDocument | undefined {
        const fileName = shared.uriToFsPath(uri);
        const version = Number(vueHost.getScriptVersion(fileName));
        if (!documents.uriHas(uri) || documents.uriGet(uri)!.version !== version) {
            const scriptSnapshot = vueHost.getScriptSnapshot(fileName);
            if (scriptSnapshot) {
                const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
                const document = TextDocument.create(uri, uri.endsWith('.vue') ? 'vue' : 'typescript', version, scriptText);
                documents.uriSet(uri, document);
            }
        }
        if (documents.uriHas(uri)) {
            return documents.uriGet(uri);
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
            const sourceFile = vueDocuments.get(uri);
            const doc = getHostDocument(uri);
            if (!doc) continue;
            if (!sourceFile) {
                vueDocuments.set(uri, createVueDocument(
                    doc.uri,
                    doc.getText(),
                    doc.version.toString(),
                    options.htmlLs,
                    options.compileTemplate,
                    options.compilerOptions,
                    options.typescript,
                    options.getCssVBindRanges,
                    options.getCssClasses,
                ));
                vueScriptContentsUpdate = true;
                vueScriptsUpdated = true;
            }
            else {
                const updates = sourceFile.update(doc.getText(), doc.version.toString());
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
                if (vueDocuments.get(uri)?.updateTemplateScript(templateTsLs)) {
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
