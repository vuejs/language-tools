import type { Range } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TeleportMappingData } from '../utils/sourceMaps';
import type { TeleportSideData } from '../utils/sourceMaps';
import type { TsMappingData } from '../utils/sourceMaps';
import type { TsSourceMap } from '../utils/sourceMaps';
import type { LanguageService as TsLanguageService } from '@volar/vscode-typescript-languageservice';
import type { LanguageService as CssLanguageService } from 'vscode-css-languageservice';
import type { LanguageService as HtmlLanguageService } from 'vscode-html-languageservice';
import type { LanguageService as PugLanguageService } from '@volar/vscode-pug-languageservice';
import type { Stylesheet } from 'vscode-css-languageservice';
import type { HTMLDocument } from 'vscode-html-languageservice';
import type { PugDocument } from '@volar/vscode-pug-languageservice';
import type { SourceFile } from '../sourceFile';
import type { MapedRange } from '@volar/source-map';
import type * as ts from 'typescript';
import * as languageServices from '../utils/languageServices';
import { fsPathToUri, uriToFsPath } from '@volar/shared';

export function createMapper(
    sourceFiles: Map<string, SourceFile>,
    tsLanguageService: TsLanguageService,
    getTextDocument: (uri: string) => TextDocument | undefined,
    getGlobalTsSourceMaps?: () => Map<string, { sourceMap: TsSourceMap }>,
) {
    return {
        css: {
            from: (cssUri: string, cssRange: Range) => {
                const result: {
                    textDocument: TextDocument,
                    range: Range,
                }[] = [];
                for (const [_, sourceFile] of sourceFiles) {
                    for (const sourceMap of sourceFile.getCssSourceMaps()) {
                        if (sourceMap.targetDocument.uri === cssUri) {
                            for (const vueMaped of sourceMap.targetToSources(cssRange)) {
                                result.push({
                                    textDocument: sourceMap.sourceDocument,
                                    range: vueMaped.range,
                                });
                            }
                        }
                    }
                }
                return result;
            },
            to: (vueUri: string, vueRange: Range) => {
                const result: {
                    textDocument: TextDocument,
                    stylesheet: Stylesheet,
                    range: Range,
                    languageService: CssLanguageService,
                }[] = [];
                const sourceFile = sourceFiles.get(vueUri);
                if (sourceFile) {
                    for (const sourceMap of sourceFile.getCssSourceMaps()) {
                        const cssLs = languageServices.getCssLanguageService(sourceMap.targetDocument.languageId);
                        if (!cssLs) continue;
                        for (const cssMaped of sourceMap.sourceToTargets(vueRange)) {
                            result.push({
                                textDocument: sourceMap.targetDocument,
                                stylesheet: sourceMap.stylesheet,
                                range: cssMaped.range,
                                languageService: cssLs,
                            });
                        }
                    }
                }
                return result;
            },
        },
        html: {
            from: (htmlUri: string, htmlRange: Range) => {
                const result: {
                    textDocument: TextDocument,
                    range: Range,
                }[] = [];
                for (const [_, sourceFile] of sourceFiles) {
                    for (const sourceMap of [...sourceFile.getHtmlSourceMaps(), ...sourceFile.getPugSourceMaps()]) {
                        if (sourceMap.targetDocument.uri === htmlUri) {
                            for (const vueLoc of sourceMap.targetToSources(htmlRange)) {
                                result.push({
                                    textDocument: sourceMap.sourceDocument,
                                    range: vueLoc.range,
                                });
                            }
                        }
                    }
                }
                return result;
            },
            to: (vueUri: string, vueRange: Range) => {
                const result: ({
                    language: 'html',
                    textDocument: TextDocument,
                    htmlDocument: HTMLDocument,
                    range: Range,
                    languageService: HtmlLanguageService,
                } | {
                    language: 'pug',
                    textDocument: TextDocument,
                    pugDocument: PugDocument,
                    range: Range,
                    languageService: PugLanguageService,
                })[] = [];
                const sourceFile = sourceFiles.get(vueUri);
                if (sourceFile) {
                    for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
                        const cssLs = languageServices.getCssLanguageService(sourceMap.targetDocument.languageId);
                        if (!cssLs) continue;
                        for (const cssMaped of sourceMap.sourceToTargets(vueRange)) {
                            result.push({
                                language: 'html',
                                textDocument: sourceMap.targetDocument,
                                htmlDocument: sourceMap.htmlDocument,
                                range: cssMaped.range,
                                languageService: languageServices.html,
                            });
                        }
                    }
                    for (const sourceMap of sourceFile.getPugSourceMaps()) {
                        const cssLs = languageServices.getCssLanguageService(sourceMap.targetDocument.languageId);
                        if (!cssLs) continue;
                        for (const cssMaped of sourceMap.sourceToTargets(vueRange)) {
                            result.push({
                                language: 'pug',
                                textDocument: sourceMap.targetDocument,
                                pugDocument: sourceMap.pugDocument,
                                range: cssMaped.range,
                                languageService: languageServices.pug,
                            });
                        }
                    }
                }
                return result;
            },
        },
        tsUri: {
            from: (tsUri: string) => {

                const sourceFile = findSourceFileByTsUri(tsUri);
                if (sourceFile) {
                    return sourceFile.getTextDocument();
                }

                const globalTs = getGlobalTsSourceMaps?.().get(tsUri);
                if (globalTs) {
                    return globalTs.sourceMap.sourceDocument;
                }

                const document = tsLanguageService.getTextDocument(tsUri);
                if (document) {
                    return document;
                }
            },
            to: (vueUri: string) => {
                const sourceFile = sourceFiles.get(vueUri);
                if (sourceFile) {
                    return {
                        languageService: tsLanguageService,
                        textDocument: sourceFile.getMainTsDoc(),
                        isVirtualFile: true,
                    }
                }
                const tsDoc = tsLanguageService.getTextDocument(vueUri);
                if (tsDoc) {
                    return {
                        languageService: tsLanguageService,
                        textDocument: tsDoc,
                        isVirtualFile: false,
                    };
                }
            },
        },
        ts: {
            from: fromTs,
            from2: fromTs2,
            to: toTs,
            to2: toTs2,
            teleports,
            teleports2,
        },
    };

    function teleports(tsUri: string, tsRange: Range) {
        const result: {
            data: TeleportMappingData;
            sideData: TeleportSideData;
            range: Range;
        }[] = [];
        const sourceFile = findSourceFileByTsUri(tsUri);
        if (sourceFile) {
            const teleports = sourceFile.getTeleports();
            for (const teleport of teleports) {
                if (teleport.document.uri === tsUri) {
                    for (const loc of teleport.findTeleports(tsRange)) {
                        result.push(loc);
                    }
                }
            }
        }
        return result;
    }
    function teleports2(tsFsPath: string, tsRange: MapedRange) {
        const result: {
            data: TeleportMappingData;
            sideData: TeleportSideData;
            range: MapedRange;
        }[] = [];
        const tsUri = fsPathToUri(tsFsPath);
        const sourceFile = findSourceFileByTsUri(tsUri);
        if (sourceFile) {
            const teleports = sourceFile.getTeleports();
            for (const teleport of teleports) {
                if (teleport.document.uri === tsUri) {
                    for (const loc of teleport.findTeleports2(tsRange)) {
                        result.push(loc);
                    }
                }
            }
        }
        return result;
    };
    function fromTs(tsUri: string, tsRange: Range) {

        const tsDoc = tsLanguageService.getTextDocument(tsUri);
        if (!tsDoc) return [];

        const _result = fromTs2(uriToFsPath(tsUri), {
            start: tsDoc.offsetAt(tsRange.start),
            end: tsDoc.offsetAt(tsRange.end),
        });

        const result: {
            textDocument: TextDocument,
            range: Range,
            data?: TsMappingData,
        }[] = [];

        for (const r of _result) {
            result.push({
                textDocument: r.textDocument,
                range: {
                    start: r.textDocument.positionAt(r.range.start),
                    end: r.textDocument.positionAt(r.range.end),
                },
                data: r.data,
            });
        }

        return result;
    };
    function fromTs2(tsFsPath: string, tsRange: MapedRange) {
        const result: {
            fileName: string,
            textDocument: TextDocument,
            range: MapedRange,
            data?: TsMappingData,
        }[] = [];
        const tsUri = fsPathToUri(tsFsPath);

        const document = tsLanguageService.getTextDocument(tsUri);
        if (!document) return [];

        const globalTs = getGlobalTsSourceMaps?.().get(tsUri);
        if (globalTs) {
            const tsMaped = globalTs.sourceMap.targetToSource2(tsRange);
            if (tsMaped) {
                tsRange = tsMaped.range;
            }
        }

        const sourceFile = findSourceFileByTsUri(tsUri);
        if (!sourceFile) {
            result.push({
                fileName: tsFsPath,
                textDocument: document,
                range: tsRange,
            });
            return result;
        }

        for (const sourceMap of sourceFile.getTsSourceMaps()) {
            if (sourceMap.targetDocument.uri !== tsUri)
                continue;
            for (const vueMaped of sourceMap.targetToSources2(tsRange)) {
                result.push({
                    fileName: uriToFsPath(sourceMap.sourceDocument.uri),
                    textDocument: sourceMap.sourceDocument,
                    range: vueMaped.range,
                    data: vueMaped.data,
                });
            }
        }

        return result;
    };
    function toTs(vueUri: string, vueRange: Range) {

        const vueDoc = getTextDocument(vueUri);
        if (!vueDoc) return [];

        const result_2 = toTs2(uriToFsPath(vueUri), {
            start: vueDoc.offsetAt(vueRange.start),
            end: vueDoc.offsetAt(vueRange.end),
        });
        const result: {
            textDocument: TextDocument,
            range: Range,
            data: TsMappingData,
            languageService: TsLanguageService,
        }[] = [];

        for (const r of result_2) {
            result.push({
                textDocument: r.textDocument,
                range: {
                    start: r.textDocument.positionAt(r.range.start),
                    end: r.textDocument.positionAt(r.range.end),
                },
                data: r.data,
                languageService: tsLanguageService,
            });
        }

        return result;
    }
    function toTs2(vueFsPath: string, vueRange: MapedRange) {
        const result: {
            fileName: string,
            textDocument: TextDocument,
            range: MapedRange,
            data: TsMappingData,
            languageService: ts.LanguageService,
        }[] = [];
        const sourceFile = sourceFiles.get(fsPathToUri(vueFsPath));
        if (sourceFile) {
            for (const sourceMap of sourceFile.getTsSourceMaps()) {
                for (const tsMaped of sourceMap.sourceToTargets2(vueRange)) {
                    result.push({
                        fileName: uriToFsPath(sourceMap.targetDocument.uri),
                        textDocument: sourceMap.targetDocument,
                        range: tsMaped.range,
                        data: tsMaped.data,
                        languageService: tsLanguageService.raw,
                    });
                }
            }
        }
        else {
            const tsDoc = tsLanguageService.getTextDocument(fsPathToUri(vueFsPath));
            if (tsDoc) {
                result.push({
                    fileName: uriToFsPath(tsDoc.uri),
                    textDocument: tsDoc,
                    range: vueRange,
                    data: {
                        vueTag: 'script',
                        capabilities: {
                            basic: true,
                            references: true,
                            definitions: true,
                            diagnostic: true,
                            formatting: true,
                            rename: true,
                            completion: true,
                            semanticTokens: true,
                            foldingRanges: true,
                            referencesCodeLens: true,
                        },
                    },
                    languageService: tsLanguageService.raw,
                });
            }
        }
        return result;
    };
    function findSourceFileByTsUri(tsUri: string) {
        for (const sourceFile of sourceFiles.values()) {
            if (sourceFile.getTsDocuments().has(tsUri)) {
                return sourceFile;
            }
        }
        return undefined;
    }
}
