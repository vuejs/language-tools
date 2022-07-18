import { EmbeddedLanguageServicePlugin, useConfigurationHost } from '@volar/vue-language-service-types';
import * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';

export default function (options: {
	documentContext?: html.DocumentContext,
	fileSystemProvider?: html.FileSystemProvider,
	validLang?: string,
	disableCustomData?: boolean,
}): EmbeddedLanguageServicePlugin & {
	htmlLs: html.LanguageService,
	getHtmlDocument(document: TextDocument): html.HTMLDocument | undefined,
	updateCustomData(extraData: html.IHTMLDataProvider[]): void,
} {

	const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();
	const htmlLs = html.getLanguageService({ fileSystemProvider: options.fileSystemProvider });

	let inited = false;
	let customData: html.IHTMLDataProvider[] = [];
	let extraData: html.IHTMLDataProvider[] = [];

	return {

		htmlLs,
		getHtmlDocument,
		updateCustomData,

		complete: {

			// https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/html-language-features/server/src/htmlServer.ts#L183
			triggerCharacters: ['.', ':', '<', '"', '=', '/'],

			async on(document, position, context) {
				return worker(document, async (htmlDocument) => {

					const configs = await useConfigurationHost()?.getConfiguration<html.CompletionConfiguration>('html.completion', document.uri);

					if (options.documentContext) {
						return htmlLs.doComplete2(document, position, htmlDocument, options.documentContext, configs);
					}
					else {
						return htmlLs.doComplete(document, position, htmlDocument, configs);
					}
				});
			},
		},

		rename: {

			on(document, position, newName) {
				return worker(document, (htmlDocument) => {
					return htmlLs.doRename(document, position, newName, htmlDocument);
				});
			},
		},

		async doHover(document, position) {
			return worker(document, async (htmlDocument) => {

				const hoverSettings = await useConfigurationHost()?.getConfiguration<html.HoverSettings>('html.hover', document.uri);

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

				if (!options.documentContext)
					return;

				return htmlLs.findDocumentLinks(document, options.documentContext);
			});
		},

		findDocumentSymbols(document) {
			return worker(document, (htmlDocument) => {
				return htmlLs.findDocumentSymbols(document, htmlDocument);
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

		async format(document, range, options) {
			return worker(document, async (htmlDocument) => {

				const formatConfiguration = await useConfigurationHost()?.getConfiguration<html.HTMLFormatConfiguration>('html.format', document.uri);

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

		async doAutoInsert(document, position, context) {
			return worker(document, async (htmlDocument) => {

				const lastCharacter = context.lastChange.text[context.lastChange.text.length - 1];

				if (context.lastChange.rangeLength === 0 && lastCharacter === '=') {

					const enabled = (await useConfigurationHost()?.getConfiguration<boolean>('html.autoCreateQuotes')) ?? true;

					if (enabled) {

						const text = htmlLs.doQuoteComplete(document, position, htmlDocument, await useConfigurationHost()?.getConfiguration<html.CompletionConfiguration>('html.completion', document.uri));

						if (text) {
							return text;
						}
					}
				}

				if (context.lastChange.rangeLength === 0 && (lastCharacter === '>' || lastCharacter === '/')) {

					const enabled = (await useConfigurationHost()?.getConfiguration<boolean>('html.autoClosingTags')) ?? true;

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

	async function initCustomData() {
		if (!inited && !options.disableCustomData) {

			inited = true;

			useConfigurationHost()?.onDidChangeConfiguration(async () => {
				customData = await getCustomData();
				htmlLs.setDataProviders(true, [...customData, ...extraData]);
			});

			customData = await getCustomData();
			htmlLs.setDataProviders(true, [...customData, ...extraData]);
		}
	}

	function updateCustomData(data: html.IHTMLDataProvider[]) {
		extraData = data;
		htmlLs.setDataProviders(true, [...customData, ...extraData]);
	}

	async function getCustomData() {

		const configHost = useConfigurationHost();

		if (configHost) {

			const paths = new Set<string>();
			const customData: string[] = await configHost.getConfiguration('html.customData') ?? [];
			const rootPaths = configHost.rootUris.map(shared.uriToFsPath);

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

	async function worker<T>(document: TextDocument, callback: (htmlDocument: html.HTMLDocument) => T) {

		const htmlDocument = getHtmlDocument(document);
		if (!htmlDocument)
			return;

		await initCustomData();

		return callback(htmlDocument);
	}

	function getHtmlDocument(document: TextDocument) {

		if (document.languageId !== (options.validLang ?? 'html'))
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
