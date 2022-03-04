import { definePlugin } from './definePlugin';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';

export default definePlugin((host) => {

    const htmlLs = html.getLanguageService({ fileSystemProvider: host.fileSystemProvider });
    const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();

    return {

        data: {
            htmlLs,
        },

        async onHover(textDocument, position) {

            const htmlDocument = getHtmlDocument(textDocument);

            if (!htmlDocument)
                return;;

            const hoverSettings = await host.getSettings<html.HoverSettings>('html.hover', textDocument.uri);

            return htmlLs.doHover(textDocument, position, htmlDocument, hoverSettings);
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

        const doc = htmlLs.parseHTMLDocument(document);
        htmlDocuments.set(document, [document.version, doc]);

        return doc;
    }
});
