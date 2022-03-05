import { TextDocument } from 'vscode-languageserver-textdocument';
import * as autoClosingTags from './services/autoClosingTags';
import * as autoCreateQuotes from './services/autoCreateQuotes';
import * as autoWrapBrackets from './services/autoWrapParentheses';
import { documentFeatureWorker, documentRangeFeatureWorker } from './utils/documentFeatureWorkers';
import * as formatting from './services/formatting';
import { createSourceFile, SourceFile } from '@volar/vue-typescript';
import { DocumentServiceRuntimeContext, LanguageServiceHost } from './types';
import { createBasicRuntime } from '@volar/vue-typescript';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';

import useVuePlugin from './plugins/vuePlugin';
import useCssPlugin from './plugins/cssPlugin';
import useHtmlPlugin from './plugins/htmlPlugin';
import usePugPlugin from './plugins/pugPlugin';
import useJsonPlugin from './plugins/jsonPlugin';
import useTsPlugin, { isTsDocument } from './plugins/tsPlugin';

// formatter plugins
import useCssFormatPlugin from './plugins/prettierCssPlugin';
import useHtmlFormatPlugin from './plugins/prettyhtmlPlugin';
import usePugFormatPlugin from './plugins/pugBeautifyPlugin';
import useSassFormatPlugin from './plugins/sassFormatterPlugin';

import * as sharedServices from './utils/sharedLs';
import * as ts2 from 'vscode-typescript-languageservice';

import type * as _0 from 'vscode-languageserver-protocol';
import { EmbeddedLanguagePlugin } from './plugins/definePlugin';
import { transformFoldingRanges, transformSelectionRanges, transformSymbolInformations } from '@volar/transforms';

export interface DocumentService extends ReturnType<typeof getDocumentService> { }

export function getDocumentService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') },
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
	getPrintWidth: (uri: string) => Promise<number>,
) {
	const vueDocuments = new WeakMap<TextDocument, SourceFile>();
	const services = createBasicRuntime();
	let tsLs: ts2.LanguageService;

	// language support plugins
	const vuePlugin = useVuePlugin({ getVueDocument });
	const htmlPlugin = patchHtmlFormat(useHtmlPlugin({ getHtmlLs: () => services.htmlLs }));
	const pugPlugin = usePugPlugin({ getPugLs: () => services.pugLs });
	const cssPlugin = useCssPlugin({ getCssLs: services.getCssLs, getStylesheet: services.getStylesheet });
	const jsonPlugin = useJsonPlugin({ getJsonLs: () => services.jsonLs });
	const tsPlugin = useTsPlugin({ getTsLs: () => tsLs });

	// formatter plugins
	const cssFormatPlugin = useCssFormatPlugin({});
	const htmlFormatPlugin = patchHtmlFormat(useHtmlFormatPlugin({ getPrintWidth }));
	const pugFormatPlugin = usePugFormatPlugin({});
	const sassFormatPlugin = useSassFormatPlugin({});

	const context: DocumentServiceRuntimeContext = {
		compilerOptions: {},
		typescript: ts,
		...services,
		getVueDocument,
		getPlugins() {
			return [
				vuePlugin,
				htmlPlugin,
				pugPlugin,
				cssPlugin,
				jsonPlugin,
				tsPlugin,
			];
		},
		getFormatPlugins() {
			return [
				cssFormatPlugin,
				htmlFormatPlugin,
				pugFormatPlugin,
				sassFormatPlugin,
				jsonPlugin,
				tsPlugin,
			];
		},
		updateTsLs(document) {
			if (isTsDocument(document)) {
				tsLs = sharedServices.getDummyTsLs(context.typescript, ts2, document, getPreferences, getFormatOptions);
			}
		},
	};
	return {
		doFormatting: formatting.register(context),

		getFoldingRanges(document: TextDocument) {
			return documentFeatureWorker(
				context,
				document,
				sourceMap => sourceMap.capabilities.foldingRanges,
				(plugin, document) => plugin.getFoldingRanges?.(document),
				(data, sourceMap) => transformFoldingRanges(
					data,
					range => sourceMap.getSourceRange(range.start, range.end)?.[0],
				),
				arr => arr.flat(),
			);
		},

		getSelectionRanges(document: TextDocument, positions: vscode.Position[]) {
			return documentRangeFeatureWorker(
				context,
				document,
				positions,
				sourceMap => true,
				(positions, sourceMap) => [positions
					.map(position => sourceMap.getMappedRange(position, position, data => !!data.capabilities.basic)?.[0].start)
					.filter(shared.notEmpty)],
				(plugin, document, positions) => plugin.getSelectionRanges?.(document, positions),
				(data, sourceMap) => transformSelectionRanges(
					data,
					range => sourceMap.getSourceRange(range.start, range.end)?.[0],
				),
				arr => arr.flat(),
			);
		},

		findLinkedEditingRanges(document: TextDocument, position: vscode.Position) {
			return documentRangeFeatureWorker(
				context,
				document,
				position,
				sourceMap => true,
				function* (position, sourceMap) {
					for (const [mapedRange] of sourceMap.getMappedRanges(
						position,
						position,
						data => !!data.capabilities.completion,
					)) {
						yield mapedRange.start;
					}
				},
				(plugin, document, position) => plugin.findLinkedEditingRanges?.(document, position),
				(data, sourceMap) => ({
					wordPattern: data.wordPattern,
					ranges: data.ranges.map(range => sourceMap.getSourceRange(range.start, range.end)?.[0]).filter(shared.notEmpty),
				}),
			);
		},

		findDocumentSymbols(document: TextDocument) {
			return documentFeatureWorker(
				context,
				document,
				sourceMap => sourceMap.capabilities.documentSymbol, // TODO: add color capabilitie setting
				(plugin, document) => plugin.findDocumentSymbols?.(document),
				(data, sourceMap) => transformSymbolInformations(
					data,
					location => {
						const sourceRange = sourceMap.getSourceRange(location.range.start, location.range.end)?.[0];
						if (sourceRange) {
							return vscode.Location.create(sourceMap.sourceDocument.uri, sourceRange);
						}
					},
				),
				arr => arr.flat(),
			);
		},

		findDocumentColors(document: TextDocument) {
			return documentFeatureWorker(
				context,
				document,
				sourceMap => sourceMap.capabilities.documentSymbol, // TODO: add color capabilitie setting
				(plugin, document) => plugin.findDocumentColors?.(document),
				(data, sourceMap) => data.map(color => {
					const range = sourceMap.getSourceRange(color.range.start, color.range.end)?.[0];
					if (range) {
						return vscode.ColorInformation.create(range, color.color);
					}
				}).filter(shared.notEmpty),
				arr => arr.flat(),
			);
		},

		getColorPresentations(document: TextDocument, color: vscode.Color, range: vscode.Range) {
			return documentRangeFeatureWorker(
				context,
				document,
				range,
				sourceMap => sourceMap.capabilities.documentSymbol, // TODO: add color capabilitie setting
				function* (range, sourceMap) {
					for (const [mapedRange] of sourceMap.getMappedRanges(range.start, range.end)) {
						yield mapedRange;
					}
				},
				(plugin, document, range) => plugin.getColorPresentations?.(document, color, range),
				(data, sourceMap) => data.map(cp => {
					if (cp.textEdit) {

						const editRange = sourceMap.getSourceRange(cp.textEdit.range.start, cp.textEdit.range.end)?.[0];

						if (!editRange)
							return undefined;

						cp.textEdit.range = editRange;
					}
					if (cp.additionalTextEdits) {
						for (const textEdit of cp.additionalTextEdits) {

							const editRange = sourceMap.getSourceRange(textEdit.range.start, textEdit.range.end)?.[0];

							if (!editRange)
								return undefined;

							textEdit.range = editRange;
						}
					}
					return cp;
				}).filter(shared.notEmpty),
			);
		},

		// auto inserts
		doQuoteComplete: autoCreateQuotes.register(context),
		doTagComplete: autoClosingTags.register(context),
		doParentheseWrap: autoWrapBrackets.register(context),
	}
	function getVueDocument(document: TextDocument) {

		if (document.languageId !== 'vue')
			return;

		const cacheVueDoc = vueDocuments.get(document);
		if (cacheVueDoc) {

			const oldText = cacheVueDoc.getTextDocument().getText();
			const newText = document.getText();

			if (oldText.length !== newText.length || oldText !== newText) {
				cacheVueDoc.update(document.getText(), document.version.toString());
			}

			return cacheVueDoc;
		}
		const vueDoc = createSourceFile(
			document.uri,
			document.getText(),
			document.version.toString(),
			context.htmlLs,
			context.compileTemplate,
			context.compilerOptions,
			context.typescript,
			context.getCssVBindRanges,
			context.getCssClasses,
		);
		vueDocuments.set(document, vueDoc);
		return vueDoc;
	}
}

function patchHtmlFormat(htmlPlugin: EmbeddedLanguagePlugin) {

	const originalFormat = htmlPlugin.format;

	if (originalFormat) {

		htmlPlugin.format = async (document, range, options) => {

			const prefixes = '<template>';
			const suffixes = '</template>';

			const patchDocument = TextDocument.create(document.uri, document.languageId, document.version, prefixes + document.getText() + suffixes);
			const result = await originalFormat?.(patchDocument, range, options);

			if (result) {
				for (const edit of result) {
					if (document.offsetAt(edit.range.start) === 0 && document.offsetAt(edit.range.end) === document.getText().length) {
						edit.newText = edit.newText.trim();
						edit.newText = edit.newText.substring(prefixes.length, edit.newText.length - suffixes.length);
					}
				}
			}

			return result;
		};
	}

	return htmlPlugin;
}
