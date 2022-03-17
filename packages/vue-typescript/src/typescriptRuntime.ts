import type { TextRange } from '@volar/vue-code-gen';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as upath from 'upath';
import useHtmlPlugin from './plugins/html';
import usePugPlugin from './plugins/pug';
import { LanguageServiceHost, VueCompilerOptions } from './types';
import * as localTypes from './utils/localTypes';
import { injectCacheLogicToLanguageServiceHost } from './utils/ts';
import { createVueFile, EmbeddedFile } from './vueFile';
import { createVueFiles } from './vueFiles';

export interface VueLanguagePlugin {

    compileTemplate?(tmplate: string, lang: string): {
        result: string,
        mapping(htmlStart: number, htmlEnd: number): { start: number, end: number } | undefined,
    } | undefined
}

export type TypeScriptRuntime = ReturnType<typeof createTypeScriptRuntime>;

export function createTypeScriptRuntime(options: {
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    vueCompilerOptions: VueCompilerOptions,
    getCssVBindRanges: (cssEmbeddeFile: EmbeddedFile) => TextRange[],
    getCssClasses: (cssEmbeddeFile: EmbeddedFile) => Record<string, TextRange[]>,
    vueLsHost: LanguageServiceHost,
    isTsPlugin?: boolean,
}) {

    const { typescript: ts } = options;

    const isVue2 = options.vueLsHost.getVueCompilationSettings?.().experimentalCompatMode === 2;

    let vueProjectVersion: string | undefined;
    let scriptContentVersion = 0; // only update by `<script>` / `<script setup>` / *.ts content
    let scriptProjectVersion = 0; // update by script LS virtual files / *.ts
    let templateProjectVersion = 0;
    let lastScriptProjectVersionWhenTemplateProjectVersionUpdate = -1;
    const vueFiles = createVueFiles();
    const templateScriptUpdateFileNames = new Set<string>();
    const initProgressCallback: ((p: number) => void)[] = [];
    const plugins = [
        useHtmlPlugin(),
        usePugPlugin(),
    ];
    const templateTsHost = options.vueCompilerOptions.experimentalDisableTemplateSupport ? undefined : createTsLsHost('template');
    const scriptTsHost = createTsLsHost('script');
    const templateTsLsRaw = templateTsHost ? ts.createLanguageService(templateTsHost) : undefined;
    const scriptTsLsRaw = ts.createLanguageService(scriptTsHost);

    if (templateTsHost && templateTsLsRaw) {
        injectCacheLogicToLanguageServiceHost(ts, templateTsHost, templateTsLsRaw);
    }
    injectCacheLogicToLanguageServiceHost(ts, scriptTsHost, scriptTsLsRaw);

    const localTypesScript = ts.ScriptSnapshot.fromString(localTypes.getTypesCode(isVue2));

    return {
        vueLsHost: options.vueLsHost,
        vueFiles,
        getTsLs: (lsType: 'template' | 'script') => lsType === 'template' ? templateTsLsRaw! : scriptTsLsRaw,
        getTsLsHost: (lsType: 'template' | 'script') => lsType === 'template' ? templateTsHost! : scriptTsHost,
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
        return vueFiles.getDirs().map(dir => upath.join(dir, localTypes.typesFileName));
    }
    function update(shouldUpdateTemplateScript: boolean) {
        const newVueProjectVersion = options.vueLsHost.getVueProjectVersion?.();
        if (newVueProjectVersion === undefined || newVueProjectVersion !== vueProjectVersion) {

            vueProjectVersion = newVueProjectVersion;

            const nowFileNames = new Set([...options.vueLsHost.getScriptFileNames()].filter(file => file.endsWith('.vue')));
            const fileNamesToRemove: string[] = [];
            const fileNamesToCreate: string[] = [];
            const fileNamesToUpdate: string[] = [];

            for (const vueFile of vueFiles.getAll()) {
                if (!nowFileNames.has(vueFile.fileName) && !options.vueLsHost.fileExists?.(vueFile.fileName)) {
                    // delete
                    fileNamesToRemove.push(vueFile.fileName);
                }
                else {
                    // update
                    const newVersion = options.vueLsHost.getScriptVersion(vueFile.fileName);
                    if (vueFile.getVersion() !== newVersion) {
                        fileNamesToUpdate.push(vueFile.fileName);
                    }
                }
            }

            for (const nowFileName of nowFileNames) {
                if (!vueFiles.get(nowFileName)) {
                    // add
                    fileNamesToCreate.push(nowFileName);
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

            const finalUpdateFileNames = fileNamesToCreate.concat(fileNamesToUpdate);

            if (fileNamesToRemove.length) {
                unsetSourceFiles(fileNamesToRemove);
            }
            if (finalUpdateFileNames.length) {
                updateSourceFiles(finalUpdateFileNames, shouldUpdateTemplateScript)
            }
        }
        else if (shouldUpdateTemplateScript && templateScriptUpdateFileNames.size) {
            updateSourceFiles([], shouldUpdateTemplateScript)
        }
    }
    function createTsLsHost(lsType: 'template' | 'script') {

        const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
        const fileVersions = new WeakMap<EmbeddedFile, string>();
        const tsHost: ts.LanguageServiceHost = {
            ...options.vueLsHost,
            fileExists: options.vueLsHost.fileExists
                ? fileName => {
                    // .vue.js -> .vue
                    // .vue.ts -> .vue
                    // .vue.d.ts (never)
                    const fileNameTrim = upath.trimExt(fileName);
                    if (fileNameTrim.endsWith('.vue')) {
                        const vueFile = vueFiles.get(fileNameTrim);
                        if (!vueFile) {
                            const fileExists = !!options.vueLsHost.fileExists?.(fileNameTrim);
                            if (fileExists) {
                                updateSourceFiles([fileNameTrim], false); // create virtual files
                            }
                        }
                        return !!vueFiles.fromEmbeddedFileName(lsType, fileName);
                    }
                    else {
                        return !!options.vueLsHost.fileExists?.(fileName);
                    }
                }
                : undefined,
            getProjectVersion: () => {
                return options.vueLsHost.getProjectVersion?.() + '-' + (lsType === 'template' ? templateProjectVersion : scriptProjectVersion).toString();
            },
            getScriptFileNames,
            getScriptVersion,
            getScriptSnapshot,
            readDirectory: (path, extensions, exclude, include, depth) => {
                const result = options.vueLsHost.readDirectory?.(path, extensions, exclude, include, depth) ?? [];
                for (const vuePath of vueFiles.getFileNames()) {
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
                ...options.vueLsHost.getCompilationSettings(),
                jsx: ts.JsxEmit.Preserve,
            });
        }

        return tsHost;

        function getScriptFileNames() {

            const tsFileNames = getLocalTypesFiles(lsType);

            for (const embedded of vueFiles.getEmbeddeds(lsType)) {
                tsFileNames.push(embedded.file.fileName); // virtual .ts
            }

            for (const fileName of options.vueLsHost.getScriptFileNames()) {
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
            const basename = upath.basename(fileName);
            if (basename === localTypes.typesFileName) {
                return '';
            }
            let embedded = vueFiles.fromEmbeddedFileName(lsType, fileName);
            if (embedded) {
                if (fileVersions.has(embedded.file)) {
                    return fileVersions.get(embedded.file)!;
                }
                else {
                    const version = ts.sys.createHash?.(embedded.file.content) ?? embedded.file.content;
                    fileVersions.set(embedded.file, version);
                    return version;
                }
            }
            return options.vueLsHost.getScriptVersion(fileName);
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
            const embedded = vueFiles.fromEmbeddedFileName(lsType, fileName);
            if (embedded) {
                const text = embedded.file.content;
                const snapshot = ts.ScriptSnapshot.fromString(text);
                scriptSnapshots.set(fileName, [version, snapshot]);
                return snapshot;
            }
            let tsScript = options.vueLsHost.getScriptSnapshot(fileName);
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
    function updateSourceFiles(fileNames: string[], shouldUpdateTemplateScript: boolean) {

        let vueScriptContentsUpdate = false;
        let vueScriptsUpdated = false;
        let templateScriptUpdated = false;

        if (shouldUpdateTemplateScript) {
            for (const cb of initProgressCallback) {
                cb(0);
            }
        }
        for (const fileName of fileNames) {

            const sourceFile = vueFiles.get(fileName);
            const scriptSnapshot = options.vueLsHost.getScriptSnapshot(fileName);

            if (!scriptSnapshot) {
                continue;
            }

            const scriptText = scriptSnapshot.getText(0, scriptSnapshot.getLength());
            const scriptVersion = options.vueLsHost.getScriptVersion(fileName);

            if (!sourceFile) {
                vueFiles.set(fileName, createVueFile(
                    fileName,
                    scriptText,
                    scriptVersion,
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
            templateScriptUpdateFileNames.add(fileName);
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
            for (const fileName of templateScriptUpdateFileNames) {
                if (templateTsLsRaw && templateTsHost && vueFiles.get(fileName)?.updateTemplateScript(templateTsLsRaw, templateTsHost)) {
                    templateScriptUpdated = true;
                }
                currentNums++;
                for (const cb of initProgressCallback) {
                    cb(currentNums / templateScriptUpdateFileNames.size);
                }
            }
            templateScriptUpdateFileNames.clear();
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
            if (vueFiles.delete(uri)) {
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
