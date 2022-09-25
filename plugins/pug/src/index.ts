import { LanguageServicePlugin, LanguageServicePluginContext } from '@volar/language-service';
import type * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as pug from '@volar/pug-language-service';
import useHtmlPlugin from '@volar-plugins/html';

export default function (): LanguageServicePlugin & ReturnType<typeof useHtmlPlugin> & {
	getHtmlLs: () => html.LanguageService,
	getPugLs: () => pug.LanguageService,
	getPugDocument: (document: TextDocument) => pug.PugDocument | undefined,
} {

	const htmlPlugin = useHtmlPlugin({});
	const pugDocuments = new WeakMap<TextDocument, [number, pug.PugDocument]>();

	let context: LanguageServicePluginContext;
	let pugLs: pug.LanguageService;

	return {

		...htmlPlugin,
		getPugLs: () => pugLs,
		getPugDocument,

		setup(_context) {
			htmlPlugin.setup?.(_context);
			pugLs = pug.getLanguageService(htmlPlugin.getHtmlLs());
			context = _context;
		},

		complete: {

			on(document, position, _) {
				return worker(document, (pugDocument) => {

					if (!context.env.documentContext)
						return;

					return pugLs.doComplete(pugDocument, position, context.env.documentContext, /** TODO: CompletionConfiguration */);
				});
			},
		},

		validation: {
			onFull(document) {
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
		},

		doHover(document, position) {
			return worker(document, async (pugDocument) => {

				const hoverSettings = await context.env.configurationHost?.getConfiguration<html.HoverSettings>('html.hover', document.uri);

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

				if (!context.env.documentContext)
					return;

				return pugLs.findDocumentLinks(pugDocument, context.env.documentContext);
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

						const text = pugLs.doQuoteComplete(pugDocument, position, await context.env.configurationHost?.getConfiguration<html.CompletionConfiguration>('html.completion', document.uri));

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
}
