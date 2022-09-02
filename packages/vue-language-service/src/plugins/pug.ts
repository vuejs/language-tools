import { EmbeddedLanguageServicePlugin, useConfigurationHost } from '@volar/vue-language-service-types';
import type * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as pug from '@volar/pug-language-service';
import useHtmlPlugin from './html';

export default function (options: {
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

	const pugLs = pug.getLanguageService(options.htmlPlugin.htmlLs);
	const pugDocuments = new WeakMap<TextDocument, [number, pug.PugDocument]>();

	return {

		...options.htmlPlugin,
		pugLs,
		getPugDocument,

		complete: {

			on(document, position, context) {
				return worker(document, (pugDocument) => {

					if (!options.documentContext)
						return;

					return pugLs.doComplete(pugDocument, position, options.documentContext, /** TODO: CompletionConfiguration */);
				});
			},
		},

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

		doHover(document, position) {
			return worker(document, async (pugDocument) => {

				const hoverSettings = await options.configurationHost?.getConfiguration<html.HoverSettings>('html.hover', document.uri);

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

				if (!options.documentContext)
					return;

				return pugLs.findDocumentLinks(pugDocument, options.documentContext);
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

		async doAutoInsert(document, position, context) {
			return worker(document, async (pugDocument) => {

				const lastCharacter = context.lastChange.text[context.lastChange.text.length - 1];

				if (context.lastChange.rangeLength === 0 && lastCharacter === '=') {

					const enabled = (await useConfigurationHost()?.getConfiguration<boolean>('html.autoCreateQuotes')) ?? true;

					if (enabled) {

						const text = pugLs.doQuoteComplete(pugDocument, position, await useConfigurationHost()?.getConfiguration<html.CompletionConfiguration>('html.completion', document.uri));

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
