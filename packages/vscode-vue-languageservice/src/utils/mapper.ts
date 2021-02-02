import type { Range } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { TeleportMappingData } from '../utils/sourceMaps';
import type { TeleportSideData } from '../utils/sourceMaps';
import type { TsMappingData } from '../utils/sourceMaps';
import type { TsSourceMap } from '../utils/sourceMaps';
import type { LanguageService as TsLanguageService } from '@volar/vscode-typescript-languageservice';
import type { LanguageService as CssLanguageService } from 'vscode-css-languageservice';
import type { LanguageService as HtmlLanguageService } from 'vscode-html-languageservice';
import type { Stylesheet } from 'vscode-css-languageservice';
import type { HTMLDocument } from 'vscode-html-languageservice';
import type { SourceFile } from '../sourceFile';
import { getCssLanguageService, html as htmlLs } from '../utils/languageServices';

export function createMapper(
    sourceFiles: Map<string, SourceFile>,
    tsLanguageService: TsLanguageService,
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
                        const cssLs = getCssLanguageService(sourceMap.targetDocument.languageId);
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
                    for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
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
                const result: {
                    textDocument: TextDocument,
                    htmlDocument: HTMLDocument,
                    range: Range,
                    languageService: HtmlLanguageService,
                }[] = [];
                const sourceFile = sourceFiles.get(vueUri);
                if (sourceFile) {
                    for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
                        const cssLs = getCssLanguageService(sourceMap.targetDocument.languageId);
                        if (!cssLs) continue;
                        for (const cssMaped of sourceMap.sourceToTargets(vueRange)) {
                            sourceMap.htmlDocument
                            result.push({
                                textDocument: sourceMap.targetDocument,
                                htmlDocument: sourceMap.htmlDocument,
                                range: cssMaped.range,
                                languageService: htmlLs,
                            });
                        }
                    }
                }
                return result;
            },
        },
        ts: {
            fromUri: (tsUri: string) => {

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
            from: (tsUri: string, tsRange: Range) => {
                const result: {
                    textDocument: TextDocument,
                    range: Range,
                    data?: TsMappingData,
                }[] = [];

                const document = tsLanguageService.getTextDocument(tsUri);
                if (!document) return [];

                const globalTs = getGlobalTsSourceMaps?.().get(tsUri);
                if (globalTs) {
                    const tsMaped = globalTs.sourceMap.targetToSource(tsRange);
                    if (tsMaped) {
                        tsRange = tsMaped.range;
                    }
                }

                const sourceFile = findSourceFileByTsUri(tsUri);
                if (!sourceFile) {
                    result.push({
                        textDocument: document,
                        range: tsRange,
                    });
                    return result;
                }

                for (const sourceMap of sourceFile.getTsSourceMaps()) {
                    if (sourceMap.targetDocument.uri !== tsUri)
                        continue;
                    for (const vueMaped of sourceMap.targetToSources(tsRange)) {
                        result.push({
                            textDocument: sourceMap.sourceDocument,
                            range: vueMaped.range,
                            data: vueMaped.data,
                        });
                    }
                }

                return result;
            },
            to: (vueUri: string, vueRange: Range) => {
                const result: {
                    textDocument: TextDocument,
                    range: Range,
                    data: TsMappingData,
                    languageService: TsLanguageService,
                }[] = [];
                const sourceFile = sourceFiles.get(vueUri);
                if (sourceFile) {
                    for (const sourceMap of sourceFile.getTsSourceMaps()) {
                        for (const tsMaped of sourceMap.sourceToTargets(vueRange)) {
                            result.push({
                                textDocument: sourceMap.targetDocument,
                                range: tsMaped.range,
                                data: tsMaped.data,
                                languageService: tsLanguageService,
                            });
                        }
                    }
                }
                else {
                    const tsDoc = tsLanguageService.getTextDocument(vueUri);
                    if (tsDoc) {
                        result.push({
                            textDocument: tsDoc,
                            range: vueRange,
                            data: {
                                vueTag: 'script',
                                capabilities: {
                                    references: true,
                                    definitions: true,
                                    completion: true,
                                },
                            },
                            languageService: tsLanguageService,
                        });
                    }
                }
                return result;
            },
            teleports: (tsUri: string, tsRange: Range) => {
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
            },
        },
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
