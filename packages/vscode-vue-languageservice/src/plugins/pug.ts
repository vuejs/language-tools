import { definePlugin } from '../utils/definePlugin';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as pug from 'vscode-pug-languageservice';

export const triggerCharacters: string[] = []; // TODO

export default definePlugin((host: {
    getPugLs(): pug.LanguageService,
    getHoverSettings?(uri: string): Promise<html.HoverSettings | undefined>,
    documentContext?: html.DocumentContext,
}) => {

    const pugDocuments = new WeakMap<TextDocument, [number, pug.PugDocument]>();

    return {

        doComplete(document, position, context) {
            return worker(document, (pugDocument) => {

                if (!host.documentContext)
                    return;

                return host.getPugLs().doComplete(pugDocument, position, host.documentContext, /** TODO: CompletionConfiguration */);
            });
        },

        doHover(document, position) {
            return worker(document, async (pugDocument) => {

                const hoverSettings = await host.getHoverSettings?.(document.uri);

                return host.getPugLs().doHover(pugDocument, position, hoverSettings);
            });
        },

        findDocumentHighlights(document, position) {
            return worker(document, (pugDocument) => {
                return host.getPugLs().findDocumentHighlights(pugDocument, position);
            });
        },

        findDocumentLinks(document) {
            return worker(document, (pugDocument) => {

                if (!host.documentContext)
                    return;

                return host.getPugLs().findDocumentLinks(pugDocument, host.documentContext);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (pugDocument) => {
                return host.getPugLs().findDocumentSymbols(pugDocument);
            });
        },

        getFoldingRanges(document) {
            return worker(document, (pugDocument) => {
                return host.getPugLs().getFoldingRanges(pugDocument);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (pugDocument) => {
                return host.getPugLs().getSelectionRanges(pugDocument, positions);
            });
        },
    };

    function worker<T>(document: TextDocument, callback: (pugDocument: pug.PugDocument) => T) {

        const pugDocument = getPugDocument(document);
        if (!pugDocument)
            return;

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

        const doc = host.getPugLs().parsePugDocument(document);
        pugDocuments.set(document, [document.version, doc]);

        return doc;
    }
});
