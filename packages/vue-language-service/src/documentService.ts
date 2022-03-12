import * as ts2 from '@volar/typescript-language-service';
import { createBasicRuntime, createVueDocument, VueDocument } from '@volar/vue-typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import useCssPlugin from './commonPlugins/css';
import useHtmlPlugin from './commonPlugins/html';
import useJsonPlugin from './commonPlugins/json';
import usePrettierPlugin from './commonPlugins/prettier';
import useHtmlFormatPlugin from './commonPlugins/prettyhtml';
import usePugPlugin from './commonPlugins/pug';
import usePugFormatPlugin from './commonPlugins/pugBeautify';
import useSassFormatPlugin from './commonPlugins/sassFormatter';
import useTsPlugin, { isTsDocument } from './commonPlugins/typescript';
import * as autoInsert from './documentFeatures/autoInsert';
import * as colorPresentations from './documentFeatures/colorPresentations';
import * as documentColors from './documentFeatures/documentColors';
import * as documentSymbols from './documentFeatures/documentSymbols';
import * as foldingRanges from './documentFeatures/foldingRanges';
import * as format from './documentFeatures/format';
import * as linkedEditingRanges from './documentFeatures/linkedEditingRanges';
import * as selectionRanges from './documentFeatures/selectionRanges';
import { DocumentServiceRuntimeContext, LanguageServiceHost } from './types';
import * as sharedServices from './utils/sharedLs';
import useAutoWrapParenthesesPlugin from './vuePlugins/autoWrapParentheses';
import useVuePlugin from './vuePlugins/vue';
import type * as _ from 'vscode-languageserver-protocol';
import { loadCustomPlugins } from './languageService';
import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';

export interface DocumentService extends ReturnType<typeof getDocumentService> { }

export function getDocumentService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') },
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
	getPrintWidth: (uri: string) => Promise<number>,
	getSettings: (<T> (section: string, scopeUri?: string) => Promise<T | undefined>) | undefined,
	rootPath: string,
) {

	const vueDocuments = new WeakMap<TextDocument, VueDocument>();
	const services = createBasicRuntime();
	let tsLs: ts2.LanguageService;

	// language support plugins
	const _getSettings: <T>(section: string, scopeUri?: string | undefined) => Promise<T | undefined> = async (section, scopeUri) => getSettings?.(section, scopeUri);
	const customPlugins = loadCustomPlugins(rootPath);
	const vuePlugin = useVuePlugin({
		getSettings: _getSettings,
		getVueDocument,
		scriptTsLs: undefined,
	});
	const htmlPlugin = patchHtmlFormat(useHtmlPlugin({
		getSettings: _getSettings,
		getHtmlLs: () => services.htmlLs,
	}));
	const pugPlugin = usePugPlugin({
		getSettings: _getSettings,
		getPugLs: () => services.pugLs
	});
	const cssPlugin = useCssPlugin({
		getSettings: _getSettings,
		getCssLs: services.getCssLs,
		getStylesheet: services.getStylesheet
	});
	const jsonPlugin = useJsonPlugin({
		getJsonLs: () => services.jsonLs,
	});
	const tsPlugin = useTsPlugin({
		getTsLs: () => tsLs,
	});
	const autoWrapParenthesesPlugin = useAutoWrapParenthesesPlugin({
		getSettings: _getSettings,
		ts,
		getVueDocument,
	});

	// formatter plugins
	const cssFormatPlugin = usePrettierPlugin(['css', 'less', 'scss', 'postcss']);
	const htmlFormatPlugin = useHtmlFormatPlugin({ getPrintWidth });
	const pugFormatPlugin = usePugFormatPlugin();
	const sassFormatPlugin = useSassFormatPlugin();
	const formatPlugns = [
		...customPlugins,
		cssFormatPlugin,
		htmlFormatPlugin,
		pugFormatPlugin,
		sassFormatPlugin,
		jsonPlugin,
		tsPlugin,
	].map(patchHtmlFormat);

	const context: DocumentServiceRuntimeContext = {
		compilerOptions: {},
		typescript: ts,
		...services,
		getVueDocument,
		getPlugins() {
			return [
				...customPlugins,
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
			return formatPlugns;
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
		const vueDoc = createVueDocument(
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

			if (document.languageId === 'html') {

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
			}

			return originalFormat?.(document, range, options);
		};
	}

	return htmlPlugin;
}
