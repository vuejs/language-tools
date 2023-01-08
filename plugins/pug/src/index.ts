import type { LanguageServicePlugin } from '@volar/language-service';
import type * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as pug from './languageService';
import useHtmlPlugin from '@volar-plugins/html';

export * from './languageService'; // TODO

const plugin: LanguageServicePlugin<{
	getHtmlLs: () => html.LanguageService,
	updateCustomData(extraData: html.IHTMLDataProvider[]): void,
	getPugLs: () => pug.LanguageService,
	getPugDocument: (document: TextDocument) => pug.PugDocument | undefined,
}> = (context, service) => {

	const pugDocuments = new WeakMap<TextDocument, [number, pug.PugDocument]>();
	const htmlPlugin = useHtmlPlugin()(context, service);
	const pugLs = pug.getLanguageService(htmlPlugin.getHtmlLs());

	return {

		...htmlPlugin,
		getPugLs: () => pugLs,
		getPugDocument,

		complete: {

			on(document, position, _) {
				return worker(document, (pugDocument) => {
					return pugLs.doComplete(pugDocument, position, context.env.documentContext, /** TODO: CompletionConfiguration */);
				});
			},
		},

		validation: {
			onSyntactic(document) {
				return worker(document, (pugDocument) => {

					if (pugDocument.error) {

						return [{
							source: 'pug',
							code: pugDocument.error.code,
							message: pugDocument.error.msg,
							range: {
								start: { line: pugDocument.error.line, character: pugDocument.error.column },
								end: { line: pugDocument.error.line, character: pugDocument.error.column },
							},
						}];
					}

					return [];
				});
			},
		},

		doHover(document, position) {
			return worker(document, async (pugDocument) => {

				const hoverSettings = await context.env.configurationHost?.getConfiguration<html.HoverSettings>('html.hover');

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
				if (context.env.documentContext) {
					return pugLs.findDocumentLinks(pugDocument, context.env.documentContext);
				}
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

		async doAutoInsert(document, position, insertContext) {
			return worker(document, async (pugDocument) => {

				const lastCharacter = insertContext.lastChange.text[insertContext.lastChange.text.length - 1];

				if (insertContext.lastChange.rangeLength === 0 && lastCharacter === '=') {

					const enabled = (await context.env.configurationHost?.getConfiguration<boolean>('html.autoCreateQuotes')) ?? true;

					if (enabled) {

						const text = pugLs.doQuoteComplete(pugDocument, position, await context.env.configurationHost?.getConfiguration<html.CompletionConfiguration>('html.completion'));

						if (text) {
							return text;
						}
					}
				}
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
};
export default () => plugin;
