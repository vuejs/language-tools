import { definePlugin } from './definePlugin';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';

export default definePlugin((host: {
    htmlLs: html.LanguageService,
    getHoverSettings(uri: string): Promise<html.HoverSettings | undefined>,
    documentContext: html.DocumentContext,
}) => {

    const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();

    return {

        triggerCharacters: [
            '.', ':', '<', '"', '=', '/', // https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/html-language-features/server/src/htmlServer.ts#L183
            '@', // vue event shorthand
        ],

        async doHover(textDocument, position) {

            const htmlDocument = getHtmlDocument(textDocument);

            if (!htmlDocument)
                return;;

            const hoverSettings = await host.getHoverSettings(textDocument.uri);

            return host.htmlLs.doHover(textDocument, position, htmlDocument, hoverSettings);
        },

        async doComplete(textDocument, position, context) {

            const htmlDocument = getHtmlDocument(textDocument);

            if (!htmlDocument)
                return;

            return host.htmlLs.doComplete2(textDocument, position, htmlDocument, host.documentContext, /** TODO: CompletionConfiguration */);
        },
    };

    function getHtmlDocument(document: TextDocument) {

        if (document.languageId !== 'vue' && document.languageId !== 'html')
            return;

        const cache = htmlDocuments.get(document);
        if (cache) {
            const [cacheVersion, cacheDoc] = cache;
            if (cacheVersion === document.version) {
                return cacheDoc;
            }
        }

        const doc = host.htmlLs.parseHTMLDocument(document);
        htmlDocuments.set(document, [document.version, doc]);

        return doc;
    }
});
