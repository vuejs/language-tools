import { definePlugin } from './definePlugin';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as pug from 'vscode-pug-languageservice';

export default definePlugin((host: {
    pugLs: pug.LanguageService,
    getHoverSettings(uri: string): Promise<html.HoverSettings | undefined>,
    documentContext: html.DocumentContext,
}) => {

    const pugDocuments = new WeakMap<TextDocument, [number, pug.PugDocument]>();

    return {

        doComplete(document, position, context) {
            return worker(document, (pugDocument) => {
                return host.pugLs.doComplete(pugDocument, position, host.documentContext, /** TODO: CompletionConfiguration */);
            });
        },

        doHover(document, position) {
            return worker(document, async (pugDocument) => {

                const hoverSettings = await host.getHoverSettings(document.uri);

                return host.pugLs.doHover(pugDocument, position, hoverSettings);
            });
        },

        findDocumentHighlights(document, position) {
            return worker(document, (pugDocument) => {
                return host.pugLs.findDocumentHighlights(pugDocument, position);
            });
        },

        findDocumentLinks(document) {
            return worker(document, (pugDocument) => {
                return host.pugLs.findDocumentLinks(pugDocument, host.documentContext);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (pugDocument) => {
                return host.pugLs.findDocumentSymbols(pugDocument);
            });
        },

        getFoldingRanges(document) {
            return worker(document, (pugDocument) => {
                return host.pugLs.getFoldingRanges(pugDocument);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (pugDocument) => {
                return host.pugLs.getSelectionRanges(pugDocument, positions);
            });
        },
    };

    function worker<T>(document: TextDocument, callback: (pugDocument: pug.PugDocument) => T) {

        const pugDocument = getPugDocument(document);
        if (!pugDocument)
            return;;

        return callback(pugDocument);
    }

    function getPugDocument(document: TextDocument) {

        if (document.languageId !== 'jade')
            return;

        const cache = pugDocuments.get(document);
        if (cache) {
            const [cacheVersion, cacheDoc] = cache;
            if (cacheVersion === document.version) {
                return cacheDoc;
            }
        }

        const doc = host.pugLs.parsePugDocument(document);
        pugDocuments.set(document, [document.version, doc]);

        return doc;
    }
});
