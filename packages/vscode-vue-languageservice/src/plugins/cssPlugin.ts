import { definePlugin } from './definePlugin';
import type * as css from 'vscode-css-languageservice';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver-protocol';

export const wordPatterns: { [lang: string]: RegExp } = {
    css: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
    less: /(#?-?\d*\.\d\w*%?)|(::?[\w-]+(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
    scss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g,
    postcss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g, // scss
};

export default definePlugin((host: {
    getCssLs(lang: string): css.LanguageService | undefined,
    getStylesheet(document: TextDocument): css.Stylesheet | undefined,
    getLanguageSettings(languageId: string, uri: string): Promise<css.LanguageSettings | undefined>,
    documentContext: css.DocumentContext,
}) => {

    return {

        triggerCharacters: ['/', '-', ':'], // https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/css-language-features/server/src/cssServer.ts#L97

        doValidation(document) {
            return worker(document, async (stylesheet, cssLs) => {

                const settings = await host.getLanguageSettings(document.languageId, document.uri);

                return cssLs.doValidation(document, stylesheet, settings) as vscode.Diagnostic[];
            });
        },

        doComplete(document, position, context) {
            return worker(document, async (stylesheet, cssLs) => {

                const wordPattern = wordPatterns[document.languageId] ?? wordPatterns.css;
                const wordStart = shared.getWordRange(wordPattern, position, document)?.start; // TODO: use end?
                const wordRange = vscode.Range.create(wordStart ?? position, position);
                const settings = await host.getLanguageSettings(document.languageId, document.uri);
                const cssResult = await cssLs.doComplete2(document, position, stylesheet, host.documentContext, settings?.completion);

                if (cssResult) {
                    for (const item of cssResult.items) {

                        if (item.textEdit)
                            continue

                        // track https://github.com/microsoft/vscode-css-languageservice/issues/265
                        const newText = item.insertText || item.label;
                        item.textEdit = vscode.TextEdit.replace(wordRange, newText);
                    }
                }

                return cssResult;
            });
        },

        doHover(document, position) {
            return worker(document, async (stylesheet, cssLs) => {

                const settings = await host.getLanguageSettings(document.languageId, document.uri);

                return cssLs.doHover(document, position, stylesheet, settings?.hover);
            });
        },

        findDefinition(document, position) {
            return worker(document, (stylesheet, cssLs) => {

                const location = cssLs.findDefinition(document, position, stylesheet);

                if (location) {
                    return [vscode.LocationLink.create(location.uri, location.range, location.range)];
                }
            });
        },

        findReferences(document, position) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.findReferences(document, position, stylesheet);
            });
        },

        findDocumentHighlights(document, position) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.findDocumentHighlights(document, position, stylesheet);
            });
        },

        findDocumentLinks(document) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.findDocumentLinks(document, stylesheet, host.documentContext);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.findDocumentSymbols(document, stylesheet);
            });
        },

        doCodeActions(document, range, context) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.doCodeActions(document, range, context, stylesheet);
            });
        },

        findDocumentColors(document) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.findDocumentColors(document, stylesheet);
            });
        },

        getColorPresentations(document, color, range) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.getColorPresentations(document, stylesheet, color, range);
            });
        },

        doRename(document, position, newName) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.doRename(document, position, newName, stylesheet);
            });
        },

        getFoldingRanges(document) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.getFoldingRanges(document, stylesheet);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (stylesheet, cssLs) => {
                return cssLs.getSelectionRanges(document, positions, stylesheet);
            });
        },
    };

    function worker<T>(document: TextDocument, callback: (stylesheet: css.Stylesheet, cssLs: css.LanguageService) => T) {

        const stylesheet = host.getStylesheet(document);
        if (!stylesheet)
            return;

        const cssLs = host.getCssLs(document.languageId);
        if (!cssLs)
            return;

        return callback(stylesheet, cssLs);
    }
});
