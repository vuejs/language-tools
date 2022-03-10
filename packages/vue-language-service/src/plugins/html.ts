import { definePlugin, EmbeddedLanguagePlugin } from '../utils/definePlugin';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';

// https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/html-language-features/server/src/htmlServer.ts#L183
export const triggerCharacters = ['.', ':', '<', '"', '=', '/'];

export default definePlugin((host: Parameters<typeof htmlPluginBase>[0]) => {

    const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();

    return htmlPluginBase(host, getHtmlDocument);

    function getHtmlDocument(document: TextDocument) {

        if (document.languageId !== 'html')
            return;

        const cache = htmlDocuments.get(document);
        if (cache) {
            const [cacheVersion, cacheDoc] = cache;
            if (cacheVersion === document.version) {
                return cacheDoc;
            }
        }

        const doc = host.getHtmlLs().parseHTMLDocument(document);
        htmlDocuments.set(document, [document.version, doc]);

        return doc;
    }
});

export function htmlPluginBase(
    host: {
        getHtmlLs(): html.LanguageService,
        getSettings?(): Promise<{
            autoCreateQuotes: boolean,
            autoClosingTags: boolean,
        } | undefined>,
        getHoverSettings?(uri: string): Promise<html.HoverSettings | undefined>,
        getCompletionConfiguration?(uri: string): Promise<html.CompletionConfiguration | undefined>,
        getFormatConfiguration?(uri: string): Promise<html.HTMLFormatConfiguration | undefined>,
        documentContext?: html.DocumentContext,
    },
    getHtmlDocument: (document: TextDocument) => html.HTMLDocument | undefined,
): EmbeddedLanguagePlugin {

    return {

        doComplete(document, position, context) {
            return worker(document, (htmlDocument) => {

                if (!host.documentContext)
                    return;

                return host.getHtmlLs().doComplete2(document, position, htmlDocument, host.documentContext, /** TODO: CompletionConfiguration */);
            });
        },

        doHover(document, position) {
            return worker(document, async (htmlDocument) => {

                const hoverSettings = await host.getHoverSettings?.(document.uri);

                return host.getHtmlLs().doHover(document, position, htmlDocument, hoverSettings);
            });
        },

        findDocumentHighlights(document, position) {
            return worker(document, (htmlDocument) => {
                return host.getHtmlLs().findDocumentHighlights(document, position, htmlDocument);
            });
        },

        findDocumentLinks(document) {
            return worker(document, (htmlDocument) => {

                if (!host.documentContext)
                    return;

                return host.getHtmlLs().findDocumentLinks(document, host.documentContext);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (htmlDocument) => {
                return host.getHtmlLs().findDocumentSymbols(document, htmlDocument);
            });
        },

        doRename(document, position, newName) {
            return worker(document, (htmlDocument) => {
                return host.getHtmlLs().doRename(document, position, newName, htmlDocument);
            });
        },

        getFoldingRanges(document) {
            return worker(document, (htmlDocument) => {
                return host.getHtmlLs().getFoldingRanges(document);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (htmlDocument) => {
                return host.getHtmlLs().getSelectionRanges(document, positions);
            });
        },

        format(document, range, options) {
            return worker(document, async (htmlDocument) => {

                const formatConfiguration = await host.getFormatConfiguration?.(document.uri);

                return host.getHtmlLs().format(document, range, {
                    ...formatConfiguration,
                    ...options,
                });
            });
        },

        findLinkedEditingRanges(document, position) {
            return worker(document, (htmlDocument) => {

                const ranges = host.getHtmlLs().findLinkedEditingRanges(document, position, htmlDocument);

                if (!ranges)
                    return;

                return { ranges };
            });
        },

        doAutoInsert(document, position, context) {
            return worker(document, async (htmlDocument) => {

                const lastCharacter = context.lastChange.text[context.lastChange.text.length - 1];

                if (context.lastChange.rangeLength === 0 && lastCharacter === '=') {

                    const enabled = (await host.getSettings?.())?.autoCreateQuotes ?? true;

                    if (enabled) {

                        const text = host.getHtmlLs().doQuoteComplete(document, position, htmlDocument, await host.getCompletionConfiguration?.(document.uri));

                        if (text) {
                            return text;
                        }
                    }
                }

                if (context.lastChange.rangeLength === 0 && (lastCharacter === '>' || lastCharacter === '/')) {

                    const enabled = (await host.getSettings?.())?.autoClosingTags ?? true;

                    if (enabled) {

                        const text = host.getHtmlLs().doTagComplete(document, position, htmlDocument);

                        if (text) {
                            return text;
                        }
                    }
                }
            });
        },
    };

    function worker<T>(document: TextDocument, callback: (htmlDocument: html.HTMLDocument) => T) {

        const htmlDocument = getHtmlDocument(document);
        if (!htmlDocument)
            return;

        return callback(htmlDocument);
    }
}
