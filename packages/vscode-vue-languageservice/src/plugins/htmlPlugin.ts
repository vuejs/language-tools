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

        doComplete(document, position, context) {
            return worker(document, (htmlDocument) => {
                return host.htmlLs.doComplete2(document, position, htmlDocument, host.documentContext, /** TODO: CompletionConfiguration */);
            });
        },

        doHover(document, position) {
            return worker(document, async (htmlDocument) => {

                const hoverSettings = await host.getHoverSettings(document.uri);

                return host.htmlLs.doHover(document, position, htmlDocument, hoverSettings);
            });
        },

        findDocumentHighlights(document, position) {
            return worker(document, (htmlDocument) => {
                return host.htmlLs.findDocumentHighlights(document, position, htmlDocument);
            });
        },

        findDocumentLinks(document) {
            return worker(document, (htmlDocument) => {
                return host.htmlLs.findDocumentLinks(document, host.documentContext);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (htmlDocument) => {
                return host.htmlLs.findDocumentSymbols(document, htmlDocument);
            });
        },

        doRename(document, position, newName) {
            return worker(document, (htmlDocument) => {
                return host.htmlLs.doRename(document, position, newName, htmlDocument);
            });
        },

        getFoldingRanges(document) {
            return worker(document, (htmlDocument) => {
                return host.htmlLs.getFoldingRanges(document);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (htmlDocument) => {
                return host.htmlLs.getSelectionRanges(document, positions);
            });
        },

        format(document, range, options) {
            return worker(document, (htmlDocument) => {
                return host.htmlLs.format(document, range, options);
            });
        },

        findLinkedEditingRanges(document, position) {
            return worker(document, (htmlDocument) => {
                return host.htmlLs.findLinkedEditingRanges(document, position, htmlDocument);
            });
        },
    };

    function worker<T>(document: TextDocument, callback: (htmlDocument: html.HTMLDocument) => T) {

        const htmlDocument = getHtmlDocument(document);
        if (!htmlDocument)
            return;;

        return callback(htmlDocument);
    }

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
