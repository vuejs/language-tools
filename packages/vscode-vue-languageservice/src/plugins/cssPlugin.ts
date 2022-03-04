import { definePlugin } from './definePlugin';
import type * as css from 'vscode-css-languageservice';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export default definePlugin((host: {
    getCssLs(lang: string): css.LanguageService | undefined,
    getStylesheet(document: TextDocument): css.Stylesheet | undefined,
    getLanguageSettings(languageId: string, uri: string): Promise<css.LanguageSettings | undefined>,
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
    };
});
