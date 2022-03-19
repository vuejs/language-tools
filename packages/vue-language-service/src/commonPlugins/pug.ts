import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import type * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as pug from '@volar/pug-language-service';
import useHtmlPlugin from './html';

export default function (host: {
    configurationHost: {
        getConfiguration: (<T> (section: string, scopeUri?: string) => Promise<T | undefined>),
        onDidChangeConfiguration: (cb: () => void) => void,
        rootUris: string[],
    } | undefined,
    documentContext?: html.DocumentContext,
    htmlPlugin: ReturnType<typeof useHtmlPlugin>,
}): EmbeddedLanguageServicePlugin & ReturnType<typeof useHtmlPlugin> & {
    htmlLs: html.LanguageService,
    pugLs: pug.LanguageService,
    getPugDocument: (document: TextDocument) => pug.PugDocument | undefined,
} {

    const pugLs = pug.getLanguageService(host.htmlPlugin.htmlLs);
    const pugDocuments = new WeakMap<TextDocument, [number, pug.PugDocument]>();

    return {

        ...host.htmlPlugin,
        pugLs,
        getPugDocument,

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

                return pugLs.doComplete(pugDocument, position, host.documentContext, /** TODO: CompletionConfiguration */);
            });
        },

        doHover(document, position) {
            return worker(document, async (pugDocument) => {

                const hoverSettings = await host.configurationHost?.getConfiguration<html.HoverSettings>('html.hover', document.uri);

                return pugLs.doHover(pugDocument, position, hoverSettings);
            });
        },

        findDocumentHighlights(document, position) {
            return worker(document, (pugDocument) => {
                return pugLs.findDocumentHighlights(pugDocument, position);
            });
        },

        findDocumentLinks(document) {
            return worker(document, (pugDocument) => {

                if (!host.documentContext)
                    return;

                return pugLs.findDocumentLinks(pugDocument, host.documentContext);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (pugDocument) => {
                return pugLs.findDocumentSymbols(pugDocument);
            });
        },

        getFoldingRanges(document) {
            return worker(document, (pugDocument) => {
                return pugLs.getFoldingRanges(pugDocument);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (pugDocument) => {
                return pugLs.getSelectionRanges(pugDocument, positions);
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

        const doc = pugLs.parsePugDocument(document.getText());
        pugDocuments.set(document, [document.version, doc]);

        return doc;
    }
}
