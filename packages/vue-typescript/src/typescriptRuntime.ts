import type { TextRange } from '@volar/vue-code-gen';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'path';
import useHtmlPlugin from './plugins/html';
import usePugPlugin from './plugins/pug';
import { LanguageServiceHost, VueCompilerOptions } from './types';
import * as localTypes from './utils/localTypes';
import { injectCacheLogicToLanguageServiceHost } from './utils/ts';
import { createVueFile, EmbeddedFile } from './vueFile';
import { createVueFiles } from './vueFiles';

export interface VueLanguagePlugin {

    compileTemplate?(tmplate: string, lang: string): {
        html: string,
        mapping(htmlStart: number, htmlEnd: number): { start: number, end: number } | undefined,
    } | undefined
}

export type TypeScriptRuntime = ReturnType<typeof createTypeScriptRuntime>;

export function createTypeScriptRuntime(options: {
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    vueCompilerOptions: VueCompilerOptions,
    baseCssModuleType: string,
    getCssClasses: (cssEmbeddeFile: EmbeddedFile) => Record<string, TextRange[]>,
    vueLsHost: LanguageServiceHost,
    isTsPlugin?: boolean,
    isVueTsc?: boolean,
}) {

    const { typescript: ts } = options;

    const isVue2 = options.vueLsHost.getVueCompilationSettings?.().experimentalCompatMode === 2;

    let lastProjectVersion: string | undefined;
    let scriptContentVersion = 0; // only update by `<script>` / `<script setup>` / *.ts content
    let tsProjectVersion = 0; // update by script LS virtual files / *.ts
    const vueFiles = createVueFiles();
    const plugins = [
        useHtmlPlugin(),
        usePugPlugin(),
    ];
    const tsLsHost = createTsLsHost();
    const tsLsRaw = ts.createLanguageService(tsLsHost);

    injectCacheLogicToLanguageServiceHost(ts, tsLsHost, tsLsRaw);

    const localTypesScript = ts.ScriptSnapshot.fromString(localTypes.getTypesCode(isVue2));

    return {
        vueLsHost: options.vueLsHost,
        vueFiles,
        getTsLs: () => tsLsRaw,
        getTsLsHost: () => tsLsHost,
        update,
        getScriptContentVersion: () => scriptContentVersion,
        dispose: () => {
            tsLsRaw.dispose();
        },
        getLocalTypesFiles: () => {
            const fileNames = getLocalTypesFiles();
            const code = localTypes.getTypesCode(isVue2);
            return {
                fileNames,
                code,
            };
        },
    };

    function getLocalTypesFiles() {
        return vueFiles.getDirs().map(dir => path.join(dir, localTypes.typesFileName));
    }
    function update() {
        const newProjectVersion = options.vueLsHost.getProjectVersion?.();
        if (newProjectVersion === undefined || newProjectVersion !== lastProjectVersion) {

            lastProjectVersion = newProjectVersion;

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
                updateSourceFiles(finalUpdateFileNames)
            }
        }
    }
    function createTsLsHost() {

        const scriptSnapshots = new Map<string, [string, ts.IScriptSnapshot]>();
        const fileVersions = new WeakMap<EmbeddedFile, string>();
        const _tsHost: Partial<ts.LanguageServiceHost> = {
            fileExists: options.vueLsHost.fileExists
                ? fileName => {
                    // .vue.js -> .vue
                    // .vue.ts -> .vue
                    // .vue.d.ts (never)
                    const fileNameTrim = fileName.substring(0, fileName.lastIndexOf('.'));

                    if (fileNameTrim.endsWith('.vue')) {
                        const vueFile = vueFiles.get(fileNameTrim);
                        if (!vueFile) {
                            const fileExists = !!options.vueLsHost.fileExists?.(fileNameTrim);
                            if (fileExists) {
                                updateSourceFiles([fileNameTrim]); // create virtual files
                            }
                        }
                    }

                    if (!!vueFiles.fromEmbeddedFileName(fileName)) {
                        return true;
                    }

                    return !!options.vueLsHost.fileExists?.(fileName);
                }
                : undefined,
            getProjectVersion: () => {
                return tsProjectVersion.toString();
            },
            getScriptFileNames,
            getScriptVersion,
            getScriptSnapshot,
            readDirectory: (_path, extensions, exclude, include, depth) => {
                const result = options.vueLsHost.readDirectory?.(_path, extensions, exclude, include, depth) ?? [];
                for (const vuePath of vueFiles.getFileNames()) {
                    const vuePath2 = path.join(_path, path.basename(vuePath));
                    if (path.relative(_path.toLowerCase(), vuePath.toLowerCase()).startsWith('..')) {
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
                switch (path.extname(fileName)) {
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

        const tsHost = new Proxy<ts.LanguageServiceHost>(_tsHost as ts.LanguageServiceHost, {
            get: (target, property: keyof ts.LanguageServiceHost) => {
                return target[property] || options.vueLsHost[property];
            },
        });

        return tsHost;

        function getScriptFileNames() {

            const tsFileNames = getLocalTypesFiles();

            for (const mapped of vueFiles.getEmbeddeds()) {
                if (mapped.embedded.file.isTsHostFile) {
                    tsFileNames.push(mapped.embedded.file.fileName); // virtual .ts
                }
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
            const basename = path.basename(fileName);
            if (basename === localTypes.typesFileName) {
                return '';
            }
            let mapped = vueFiles.fromEmbeddedFileName(fileName);
            if (mapped) {
                if (fileVersions.has(mapped.embedded.file)) {
                    return fileVersions.get(mapped.embedded.file)!;
                }
                else {
                    let version = ts.sys.createHash?.(mapped.embedded.file.content) ?? mapped.embedded.file.content;
                    if (options.isVueTsc) {
                        // fix https://github.com/johnsoncodehk/volar/issues/1082
                        version = mapped.vueFile.getVersion() + ':' + version;
                    }
                    fileVersions.set(mapped.embedded.file, version);
                    return version;
                }
            }
            return options.vueLsHost.getScriptVersion(fileName);
        }
        function getScriptSnapshot(fileName: string) {
            const version = getScriptVersion(fileName);
            const cache = scriptSnapshots.get(fileName.toLowerCase());
            if (cache && cache[0] === version) {
                return cache[1];
            }
            const basename = path.basename(fileName);
            if (basename === localTypes.typesFileName) {
                return localTypesScript;
            }
            const mapped = vueFiles.fromEmbeddedFileName(fileName);
            if (mapped) {
                const text = mapped.embedded.file.content;
                const snapshot = ts.ScriptSnapshot.fromString(text);
                scriptSnapshots.set(fileName.toLowerCase(), [version, snapshot]);
                return snapshot;
            }
            let tsScript = options.vueLsHost.getScriptSnapshot(fileName);
            if (tsScript) {
                if (basename === 'runtime-dom.d.ts') {
                    // allow arbitrary attributes
                    let tsScriptText = tsScript.getText(0, tsScript.getLength());
                    tsScriptText = tsScriptText.replace('type ReservedProps = {', 'type ReservedProps = { [name: string]: any')
                    tsScript = ts.ScriptSnapshot.fromString(tsScriptText);
                }
                scriptSnapshots.set(fileName.toLowerCase(), [version, tsScript]);
                return tsScript;
            }
        }
    }
    function updateSourceFiles(fileNames: string[]) {

        let vueScriptContentsUpdate = false;
        let vueScriptsUpdated = false;

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
                    options.baseCssModuleType,
                    options.getCssClasses,
                    tsLsRaw,
                    tsLsHost,
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
            }
        }
        if (vueScriptContentsUpdate) {
            scriptContentVersion++;
        }
        if (vueScriptsUpdated) {
            tsProjectVersion++;
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
            tsProjectVersion++;
        }
    }
}
