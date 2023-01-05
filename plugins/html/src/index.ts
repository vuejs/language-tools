import type { LanguageServicePlugin } from '@volar/language-service';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';

const createPlugin = (options: {
	validLang?: string,
	disableCustomData?: boolean,
} = {}) => {

	const plugin: LanguageServicePlugin<{
		getHtmlLs: () => html.LanguageService,
		updateCustomData(extraData: html.IHTMLDataProvider[]): void,
	}> = (context) => {

		const htmlDocuments = new WeakMap<TextDocument, [number, html.HTMLDocument]>();

		let inited = false;
		let customData: html.IHTMLDataProvider[] = [];
		let extraData: html.IHTMLDataProvider[] = [];
		const htmlLs = html.getLanguageService({ fileSystemProvider: context.env.fileSystemProvider });

		return {

			getHtmlLs: () => htmlLs,

			updateCustomData,

			complete: {

				// https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/html-language-features/server/src/htmlServer.ts#L183
				triggerCharacters: ['.', ':', '<', '"', '=', '/'],

				async on(document, position) {
					return worker(document, async (htmlDocument) => {

						const configs = await context.env.configurationHost?.getConfiguration<html.CompletionConfiguration>('html.completion');

						if (context.env.documentContext) {
							return htmlLs.doComplete2(document, position, htmlDocument, context.env.documentContext, configs);
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

					const hoverSettings = await context.env.configurationHost?.getConfiguration<html.HoverSettings>('html.hover');

					return htmlLs.doHover(document, position, htmlDocument, hoverSettings);
				});
			},

			findDocumentHighlights(document, position) {
				return worker(document, (htmlDocument) => {
					return htmlLs.findDocumentHighlights(document, position, htmlDocument);
				});
			},

			findDocumentLinks(document) {
				return worker(document, () => {

					if (!context.env.documentContext)
						return;

					return htmlLs.findDocumentLinks(document, context.env.documentContext);
				});
			},

			findDocumentSymbols(document) {
				return worker(document, (htmlDocument) => {
					return htmlLs.findDocumentSymbols(document, htmlDocument);
				});
			},

			getFoldingRanges(document) {
				return worker(document, () => {
					return htmlLs.getFoldingRanges(document);
				});
			},

			getSelectionRanges(document, positions) {
				return worker(document, () => {
					return htmlLs.getSelectionRanges(document, positions);
				});
			},

			async format(document, formatRange, options) {
				return worker(document, async () => {

					const options_2 = await context.env.configurationHost?.getConfiguration<html.HTMLFormatConfiguration & { enable: boolean; }>('html.format');

					if (options_2?.enable === false) {
						return;
					}

					{ // https://github.com/microsoft/vscode/blob/dce493cb6e36346ef2714e82c42ce14fc461b15c/extensions/html-language-features/server/src/modes/formatting.ts#L13-L23
						const endPos = formatRange.end;
						let endOffset = document.offsetAt(endPos);
						const content = document.getText();
						if (endPos.character === 0 && endPos.line > 0 && endOffset !== content.length) {
							// if selection ends after a new line, exclude that new line
							const prevLineStart = document.offsetAt(vscode.Position.create(endPos.line - 1, 0));
							while (isEOL(content, endOffset - 1) && endOffset > prevLineStart) {
								endOffset--;
							}
							formatRange = vscode.Range.create(formatRange.start, document.positionAt(endOffset));
						}
					}

					const edits = htmlLs.format(document, formatRange, {
						...options_2,
						...options,
					});

					const newText = TextDocument.applyEdits(document, edits);

					return [{
						newText: '\n' + newText.trim() + '\n',
						range: {
							start: document.positionAt(0),
							end: document.positionAt(document.getText().length),
						},
					}];
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

			async doAutoInsert(document, position, insertContext) {
				return worker(document, async (htmlDocument) => {

					const lastCharacter = insertContext.lastChange.text[insertContext.lastChange.text.length - 1];

					if (insertContext.lastChange.rangeLength === 0 && lastCharacter === '=') {

						const enabled = (await context.env.configurationHost?.getConfiguration<boolean>('html.autoCreateQuotes')) ?? true;

						if (enabled) {

							const text = htmlLs.doQuoteComplete(document, position, htmlDocument, await context.env.configurationHost?.getConfiguration<html.CompletionConfiguration>('html.completion'));

							if (text) {
								return text;
							}
						}
					}

					if (insertContext.lastChange.rangeLength === 0 && (lastCharacter === '>' || lastCharacter === '/')) {

						const enabled = (await context.env.configurationHost?.getConfiguration<boolean>('html.autoClosingTags')) ?? true;

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

				context.env.configurationHost?.onDidChangeConfiguration(async () => {
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

			const configHost = context.env.configurationHost;

			if (configHost) {

				const customData: string[] = await configHost.getConfiguration('html.customData') ?? [];
				const newData: html.IHTMLDataProvider[] = [];

				for (const customDataPath of customData) {
					try {
						const jsonPath = path.resolve(customDataPath);
						newData.push(html.newHTMLDataProvider(customDataPath, require(jsonPath)));
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
	};

	return plugin;
};

export default createPlugin;

function isEOL(content: string, offset: number) {
	return isNewlineCharacter(content.charCodeAt(offset));
}

const CR = '\r'.charCodeAt(0);
const NL = '\n'.charCodeAt(0);
function isNewlineCharacter(charCode: number) {
	return charCode === CR || charCode === NL;
}
