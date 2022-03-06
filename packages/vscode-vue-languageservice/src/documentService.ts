import { createBasicRuntime, createSourceFile, SourceFile } from '@volar/vue-typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as ts2 from 'vscode-typescript-languageservice';
import * as autoInsert from './documentFeatures/autoInsert';
import * as colorPresentations from './documentFeatures/colorPresentations';
import * as documentColors from './documentFeatures/documentColors';
import * as documentSymbols from './documentFeatures/documentSymbols';
import * as foldingRanges from './documentFeatures/foldingRanges';
import * as format from './documentFeatures/format';
import * as linkedEditingRanges from './documentFeatures/linkedEditingRanges';
import * as selectionRanges from './documentFeatures/selectionRanges';
import useAutoWrapParenthesesPlugin from './plugins/autoWrapParenthesesPlugin';
import useCssPlugin from './plugins/cssPlugin';
import { EmbeddedLanguagePlugin } from './plugins/definePlugin';
import useHtmlPlugin from './plugins/htmlPlugin';
import useJsonPlugin from './plugins/jsonPlugin';
import useCssFormatPlugin from './plugins/prettierCssPlugin';
import useHtmlFormatPlugin from './plugins/prettyhtmlPlugin';
import usePugFormatPlugin from './plugins/pugBeautifyPlugin';
import usePugPlugin from './plugins/pugPlugin';
import useSassFormatPlugin from './plugins/sassFormatterPlugin';
import useTsPlugin, { isTsDocument } from './plugins/tsPlugin';
import useVuePlugin from './plugins/vuePlugin';
import { DocumentServiceRuntimeContext, LanguageServiceHost } from './types';
import * as sharedServices from './utils/sharedLs';
import type * as _ from 'vscode-languageserver-protocol';

export interface DocumentService extends ReturnType<typeof getDocumentService> { }

export function getDocumentService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') },
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
	getPrintWidth: (uri: string) => Promise<number>,
	getSettings: (<T> (section: string, scopeUri?: string) => Promise<T | undefined>) | undefined,
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
	const autoWrapParenthesesPlugin = useAutoWrapParenthesesPlugin({ ts, getVueDocument, isEnabled: async () => getSettings?.('volar.autoWrapParentheses') });

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
				autoWrapParenthesesPlugin,
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
		format: format.register(context),
		getFoldingRanges: foldingRanges.register(context),
		getSelectionRanges: selectionRanges.register(context),
		findLinkedEditingRanges: linkedEditingRanges.register(context),
		findDocumentSymbols: documentSymbols.register(context),
		findDocumentColors: documentColors.register(context),
		getColorPresentations: colorPresentations.register(context),
		doAutoInsert: autoInsert.register(context),
	};

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
