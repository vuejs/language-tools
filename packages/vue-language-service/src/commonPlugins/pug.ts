import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as pug from '@volar/pug-language-service';

export const triggerCharacters: string[] = []; // TODO

export type PugDocuments = ReturnType<typeof createPugDocuments>;

export function createPugDocuments(pugLs: pug.LanguageService) {

    const pugDocuments = new WeakMap<TextDocument, [number, pug.PugDocument]>();

    return {
        get: getPugDocument,
    };

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

        const doc = pugLs.parsePugDocument(document.getText());
        pugDocuments.set(document, [document.version, doc]);

        return doc;
    }
}

export default function (host: {
    getSettings: <S>(section: string, scopeUri?: string | undefined) => Promise<S | undefined>,
    getPugLs(): pug.LanguageService,
    documentContext?: html.DocumentContext,
    pugDocuments: PugDocuments,
}): EmbeddedLanguagePlugin {

    return {

        doValidation(document) {
            return worker(document, (pugDocument) => {

                if (pugDocument.error) {

                    return [{
                        code: pugDocument.error.code,
                        message: pugDocument.error.msg,
                        range: {
                            start: { line: pugDocument.error.line, character: pugDocument.error.column },
                            end: { line: pugDocument.error.line, character: pugDocument.error.column },
                        },
                    }];
                }
            });
        },

        doComplete(document, position, context) {
            return worker(document, (pugDocument) => {

                if (!host.documentContext)
                    return;

                return host.getPugLs().doComplete(pugDocument, position, host.documentContext, /** TODO: CompletionConfiguration */);
            });
        },

        doHover(document, position) {
            return worker(document, async (pugDocument) => {

                const hoverSettings = await host.getSettings<html.HoverSettings>('html.hover', document.uri);

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

        const pugDocument = host.pugDocuments.get(document);
        if (!pugDocument)
            return;

        return callback(pugDocument);
    }
}
