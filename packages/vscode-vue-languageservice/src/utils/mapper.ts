import type { Position } from 'vscode-languageserver/node';
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
            from: (cssUri: string, cssStart: Position, cssEnd?: Position) => {
                const result: {
                    textDocument: TextDocument,
                    start: Position,
                    end: Position,
                }[] = [];
                for (const [_, sourceFile] of sourceFiles) {
                    for (const sourceMap of sourceFile.getCssSourceMaps()) {
                        if (sourceMap.mappedDocument.uri === cssUri) {
                            for (const vueRange of sourceMap.getSourceRanges(cssStart, cssEnd)) {
                                result.push({
                                    textDocument: sourceMap.sourceDocument,
                                    start: vueRange.start,
                                    end: vueRange.end,
                                });
                            }
                        }
                    }
                }
                return result;
            },
            to: (vueUri: string, vueStart: Position, vueEnd?: Position) => {
                const result: {
                    textDocument: TextDocument,
                    stylesheet: Stylesheet,
                    start: Position,
                    end: Position,
                    languageService: CssLanguageService,
                }[] = [];
                const sourceFile = sourceFiles.get(vueUri);
                if (sourceFile) {
                    for (const sourceMap of sourceFile.getCssSourceMaps()) {
                        const cssLs = languageServices.getCssLanguageService(sourceMap.mappedDocument.languageId);
                        if (!cssLs || !sourceMap.stylesheet) continue;
                        for (const cssRange of sourceMap.getMappedRanges(vueStart, vueEnd)) {
                            result.push({
                                textDocument: sourceMap.mappedDocument,
                                stylesheet: sourceMap.stylesheet,
                                start: cssRange.start,
                                end: cssRange.end,
                                languageService: cssLs,
                            });
                        }
                    }
                }
                return result;
            },
        },
        html: {
            from: (htmlUri: string, htmlStart: Position, htmlEnd?: Position) => {
                const result: {
                    textDocument: TextDocument,
                    start: Position,
                    end: Position,
                }[] = [];
                for (const [_, sourceFile] of sourceFiles) {
                    for (const sourceMap of [...sourceFile.getHtmlSourceMaps(), ...sourceFile.getPugSourceMaps()]) {
                        if (sourceMap.mappedDocument.uri === htmlUri) {
                            for (const vueRange of sourceMap.getSourceRanges(htmlStart, htmlEnd)) {
                                result.push({
                                    textDocument: sourceMap.sourceDocument,
                                    start: vueRange.start,
                                    end: vueRange.end,
                                });
                            }
                        }
                    }
                }
                return result;
            },
            to: (vueUri: string, vueStart: Position, vueEnd?: Position) => {
                const result: ({
                    language: 'html',
                    textDocument: TextDocument,
                    htmlDocument: HTMLDocument,
                    start: Position,
                    end: Position,
                    languageService: HtmlLanguageService,
                } | {
                    language: 'pug',
                    textDocument: TextDocument,
                    pugDocument: PugDocument,
                    start: Position,
                    end: Position,
                    languageService: PugLanguageService,
                })[] = [];
                const sourceFile = sourceFiles.get(vueUri);
                if (sourceFile) {
                    for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
                        const cssLs = languageServices.getCssLanguageService(sourceMap.mappedDocument.languageId);
                        if (!cssLs) continue;
                        for (const cssRange of sourceMap.getMappedRanges(vueStart, vueEnd)) {
                            result.push({
                                language: 'html',
                                textDocument: sourceMap.mappedDocument,
                                htmlDocument: sourceMap.htmlDocument,
                                start: cssRange.start,
                                end: cssRange.end,
                                languageService: languageServices.html,
                            });
                        }
                    }
                    for (const sourceMap of sourceFile.getPugSourceMaps()) {
                        const cssLs = languageServices.getCssLanguageService(sourceMap.mappedDocument.languageId);
                        if (!cssLs) continue;
                        for (const cssRange of sourceMap.getMappedRanges(vueStart, vueEnd)) {
                            result.push({
                                language: 'pug',
                                textDocument: sourceMap.mappedDocument,
                                pugDocument: sourceMap.pugDocument,
                                start: cssRange.start,
                                end: cssRange.end,
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

    function teleports(tsUri: string, tsStart: Position, tsEnd?: Position) {
        const result: {
            data: TeleportMappingData;
            sideData: TeleportSideData;
            start: Position,
            end: Position,
        }[] = [];
        const sourceFile = findSourceFileByTsUri(tsUri);
        if (sourceFile) {
            const teleports = sourceFile.getTeleports();
            for (const teleport of teleports) {
                if (teleport.document.uri === tsUri) {
                    for (const teleRange of teleport.findTeleports(tsStart, tsEnd)) {
                        result.push(teleRange);
                    }
                }
            }
        }
        return result;
    }
    function teleports2(tsFsPath: string, tsStart: number, tsEnd?: number) {
        const result: {
            data: TeleportMappingData;
            sideData: TeleportSideData;
            start: number,
            end: number,
        }[] = [];
        const tsUri = fsPathToUri(tsFsPath);
        const sourceFile = findSourceFileByTsUri(tsUri);
        if (sourceFile) {
            const teleports = sourceFile.getTeleports();
            for (const teleport of teleports) {
                if (teleport.document.uri === tsUri) {
                    for (const teleRange of teleport.findTeleports2(tsStart, tsEnd)) {
                        result.push(teleRange);
                    }
                }
            }
        }
        return result;
    };
    function fromTs(tsUri: string, tsStart: Position, tsEnd?: Position) {

        const tsDoc = tsLanguageService.getTextDocument(tsUri);
        if (!tsDoc) return [];

        const _result = fromTs2(
            uriToFsPath(tsUri),
            tsDoc.offsetAt(tsStart),
            tsEnd ? tsDoc.offsetAt(tsEnd) : undefined,
        );

        const result: {
            textDocument: TextDocument,
            start: Position,
            end: Position,
            data?: TsMappingData,
        }[] = [];

        for (const r of _result) {
            result.push({
                textDocument: r.textDocument,
                start: r.textDocument.positionAt(r.start),
                end: r.textDocument.positionAt(r.end),
                data: r.data,
            });
        }

        return result;
    };
    function fromTs2(tsFsPath: string, tsStart: number, tsEnd?: number) {
        tsEnd = tsEnd ?? tsStart;

        const result: {
            fileName: string,
            textDocument: TextDocument,
            start: number,
            end: number,
            data?: TsMappingData,
        }[] = [];
        const tsUri = fsPathToUri(tsFsPath);

        const document = tsLanguageService.getTextDocument(tsUri);
        if (!document) return [];

        const globalTs = getGlobalTsSourceMaps?.().get(tsUri);
        if (globalTs) {
            const tsRange2 = globalTs.sourceMap.getSourceRange2(tsStart, tsEnd);
            if (tsRange2) {
                tsStart = tsRange2.start;
                tsEnd = tsRange2.end;
            }
            else {
                return [];
            }
        }

        const sourceFile = findSourceFileByTsUri(tsUri);
        if (!sourceFile) {
            result.push({
                fileName: tsFsPath,
                textDocument: document,
                start: tsStart,
                end: tsEnd,
            });
            return result;
        }

        for (const sourceMap of sourceFile.getTsSourceMaps()) {
            if (sourceMap.mappedDocument.uri !== tsUri)
                continue;
            for (const vueRange of sourceMap.getSourceRanges2(tsStart, tsEnd)) {
                result.push({
                    fileName: uriToFsPath(sourceMap.sourceDocument.uri),
                    textDocument: sourceMap.sourceDocument,
                    start: vueRange.start,
                    end: vueRange.end,
                    data: vueRange.data,
                });
            }
        }

        return result;
    };
    function toTs(vueUri: string, vueStart: Position, vueEnd?: Position) {

        const vueDoc = getTextDocument(vueUri);
        if (!vueDoc) return [];

        const result_2 = toTs2(
            uriToFsPath(vueUri),
            vueDoc.offsetAt(vueStart),
            vueEnd ? vueDoc.offsetAt(vueEnd) : undefined,
        );
        const result: {
            sourceMap: TsSourceMap | undefined,
            textDocument: TextDocument,
            start: Position,
            end: Position,
            data: TsMappingData,
            languageService: TsLanguageService,
        }[] = [];

        for (const r of result_2) {
            result.push({
                sourceMap: r.sourceMap,
                textDocument: r.textDocument,
                start: r.textDocument.positionAt(r.start),
                end: r.textDocument.positionAt(r.end),
                data: r.data,
                languageService: tsLanguageService,
            });
        }

        return result;
    }
    function toTs2(vueFsPath: string, vueStart: number, vueEnd?: number) {
        vueEnd = vueEnd ?? vueStart;

        const result: {
            sourceMap: TsSourceMap | undefined,
            fileName: string,
            textDocument: TextDocument,
            start: number,
            end: number,
            data: TsMappingData,
            languageService: ts.LanguageService,
        }[] = [];
        const sourceFile = sourceFiles.get(fsPathToUri(vueFsPath));
        if (sourceFile) {
            for (const sourceMap of sourceFile.getTsSourceMaps()) {
                for (const tsRange of sourceMap.getMappedRanges2(vueStart, vueEnd)) {
                    result.push({
                        sourceMap: sourceMap,
                        fileName: uriToFsPath(sourceMap.mappedDocument.uri),
                        textDocument: sourceMap.mappedDocument,
                        start: tsRange.start,
                        end: tsRange.end,
                        data: tsRange.data,
                        languageService: tsLanguageService.raw,
                    });
                }
            }
        }
        else {
            const tsDoc = tsLanguageService.getTextDocument(fsPathToUri(vueFsPath));
            if (tsDoc) {
                result.push({
                    sourceMap: undefined,
                    fileName: uriToFsPath(tsDoc.uri),
                    textDocument: tsDoc,
                    start: vueStart,
                    end: vueEnd,
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
