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

        async onHover(textDocument, position) {

            const stylesheet = host.getStylesheet(textDocument);
            if (!stylesheet)
                return;

            const cssLs = host.getCssLs(textDocument.languageId);
            if (!cssLs)
                return;

            const settings = await host.getLanguageSettings(textDocument.languageId, textDocument.uri);

            return cssLs.doHover(textDocument, position, stylesheet, settings?.hover);
        },

        async onCompletion(textDocument, position, context) {

            const stylesheet = host.getStylesheet(textDocument);
            if (!stylesheet)
                return;

            const cssLs = host.getCssLs(textDocument.languageId);
            if (!cssLs)
                return;

            const wordPattern = wordPatterns[textDocument.languageId] ?? wordPatterns.css;
            const wordStart = shared.getWordRange(wordPattern, position, textDocument)?.start; // TODO: use end?
            const wordRange = vscode.Range.create(wordStart ?? position, position);
            const settings = await host.getLanguageSettings(textDocument.languageId, textDocument.uri);
            const cssResult = await cssLs.doComplete2(textDocument, position, stylesheet, host.documentContext, settings?.completion);

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
        },
    };
});
