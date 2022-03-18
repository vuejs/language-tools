import { ConfigurationHost, EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';

export default function (host: {
    configurationHost: ConfigurationHost | undefined
    documentContext?: html.DocumentContext,
    fileSystemProvider?: html.FileSystemProvider,
}): EmbeddedLanguageServicePlugin & {
    htmlLs: html.LanguageService,
    getHtmlDocument(document: TextDocument): html.HTMLDocument | undefined,
    getHtmlDataProviders(): html.IHTMLDataProvider[],
} {

    const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();
    const htmlLs = html.getLanguageService({ fileSystemProvider: host.fileSystemProvider });

    let customData: html.IHTMLDataProvider[] = [];

    getCustomData().then(data => {
        customData = data;
        htmlLs.setDataProviders(true, customData);
    });

    host.configurationHost?.onDidChangeConfiguration(async () => {
        customData = await getCustomData();
        htmlLs.setDataProviders(true, customData);
    });

    return {

        htmlLs,
        getHtmlDocument,
        getHtmlDataProviders: () => customData,

        doComplete(document, position, context) {
            return worker(document, (htmlDocument) => {

                if (!host.documentContext)
                    return;

                return htmlLs.doComplete2(document, position, htmlDocument, host.documentContext, /** TODO: CompletionConfiguration */);
            });
        },

        doHover(document, position) {
            return worker(document, async (htmlDocument) => {

                const hoverSettings = await host.configurationHost?.getConfiguration<html.HoverSettings>('html.hover', document.uri);

                return htmlLs.doHover(document, position, htmlDocument, hoverSettings);
            });
        },

        findDocumentHighlights(document, position) {
            return worker(document, (htmlDocument) => {
                return htmlLs.findDocumentHighlights(document, position, htmlDocument);
            });
        },

        findDocumentLinks(document) {
            return worker(document, (htmlDocument) => {

                if (!host.documentContext)
                    return;

                return htmlLs.findDocumentLinks(document, host.documentContext);
            });
        },

        findDocumentSymbols(document) {
            return worker(document, (htmlDocument) => {
                return htmlLs.findDocumentSymbols(document, htmlDocument);
            });
        },

        doRename(document, position, newName) {
            return worker(document, (htmlDocument) => {
                return htmlLs.doRename(document, position, newName, htmlDocument);
            });
        },

        getFoldingRanges(document) {
            return worker(document, (htmlDocument) => {
                return htmlLs.getFoldingRanges(document);
            });
        },

        getSelectionRanges(document, positions) {
            return worker(document, (htmlDocument) => {
                return htmlLs.getSelectionRanges(document, positions);
            });
        },

        format(document, range, options) {
            return worker(document, async (htmlDocument) => {

                const formatConfiguration = await host.configurationHost?.getConfiguration<html.HTMLFormatConfiguration>('html.format', document.uri);

                return htmlLs.format(document, range, {
                    ...formatConfiguration,
                    ...options,
                });
            });
        },

        findLinkedEditingRanges(document, position) {
            return worker(document, (htmlDocument) => {

                const ranges = htmlLs.findLinkedEditingRanges(document, position, htmlDocument);

                if (!ranges)
                    return;

                return { ranges };
            });
        },

        doAutoInsert(document, position, context) {
            return worker(document, async (htmlDocument) => {

                const lastCharacter = context.lastChange.text[context.lastChange.text.length - 1];

                if (context.lastChange.rangeLength === 0 && lastCharacter === '=') {

                    const enabled = (await host.configurationHost?.getConfiguration<boolean>('html.autoCreateQuotes')) ?? true;

                    if (enabled) {

                        const text = htmlLs.doQuoteComplete(document, position, htmlDocument, await host.configurationHost?.getConfiguration<html.CompletionConfiguration>('html.completion', document.uri));

                        if (text) {
                            return text;
                        }
                    }
                }

                if (context.lastChange.rangeLength === 0 && (lastCharacter === '>' || lastCharacter === '/')) {

                    const enabled = (await host.configurationHost?.getConfiguration<boolean>('html.autoClosingTags')) ?? true;

                    if (enabled) {

                        const text = htmlLs.doTagComplete(document, position, htmlDocument);

                        if (text) {
                            return text;
                        }
                    }
                }
            });
        },
    };

    async function getCustomData() {

        if (host.configurationHost) {

            const paths = new Set<string>();
            const customData: string[] = await host.configurationHost.getConfiguration('html.customData') ?? [];
            const rootPaths = host.configurationHost.rootUris.map(shared.uriToFsPath);

            for (const customDataPath of customData) {
                try {
                    const jsonPath = require.resolve(customDataPath, { paths: rootPaths });
                    paths.add(jsonPath);
                }
                catch (error) {
                    console.error(error);
                }
            }

            const newData: html.IHTMLDataProvider[] = [];

            for (const path of paths) {
                try {
                    newData.push(html.newHTMLDataProvider(path, require(path)));
                }
                catch (error) {
                    console.error(error);
                }
            }

            return newData;
        }

        return [];
    }

    function worker<T>(document: TextDocument, callback: (htmlDocument: html.HTMLDocument) => T) {

        const htmlDocument = getHtmlDocument(document);
        if (!htmlDocument)
            return;

        return callback(htmlDocument);
    }

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

        const doc = htmlLs.parseHTMLDocument(document);
        htmlDocuments.set(document, [document.version, doc]);

        return doc;
    }
}
