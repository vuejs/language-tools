import * as ts2 from '@volar/typescript-language-service';
import * as vueTs from '@volar/vue-typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import useCssPlugin from './commonPlugins/css';
import useHtmlPlugin from './commonPlugins/html';
import useJsonPlugin from './commonPlugins/json';
import usePrettierPlugin from './commonPlugins/prettier';
import useHtmlFormatPlugin from './commonPlugins/prettyhtml';
import usePugPlugin, { createPugDocuments } from './commonPlugins/pug';
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
import { DocumentServiceRuntimeContext } from './types';
import * as sharedServices from './utils/sharedLs';
import useAutoWrapParenthesesPlugin from './vuePlugins/autoWrapParentheses';
import useVuePlugin from './vuePlugins/vue';
import type * as _ from 'vscode-languageserver-protocol';
import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import * as json from 'vscode-json-languageservice';
import { getTsSettings } from './tsConfigs';
import type * as html from 'vscode-html-languageservice';
import { createBasicRuntime } from './basicRuntime';
import * as shared from '@volar/shared';
import { parseVueDocument, VueDocument } from './vueDocuments';

export interface DocumentService extends ReturnType<typeof getDocumentService> { }

export function getDocumentService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') },
	getPrintWidth: (uri: string) => Promise<number>,
	getSettings: (<T> (section: string, scopeUri?: string) => Promise<T | undefined>) | undefined,
	fileSystemProvider: html.FileSystemProvider | undefined,
	customPlugins: EmbeddedLanguageServicePlugin[],
) {

	const vueDocuments = new WeakMap<TextDocument, VueDocument>();
	const services = createBasicRuntime(fileSystemProvider);
	let tsLs: ts2.LanguageService;

	const jsonLs = json.getLanguageService({});
	const _getSettings: <T>(section: string, scopeUri?: string | undefined) => Promise<T | undefined> = async (section, scopeUri) => getSettings?.(section, scopeUri);
	const tsSettings = getTsSettings(_getSettings);

	// embedded documents
	const pugDocuments = createPugDocuments(services.pugLs);

	// language support plugins
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
		getPugLs: () => services.pugLs,
		pugDocuments,
	});
	const cssPlugin = useCssPlugin({
		getSettings: _getSettings,
		getCssLs: services.getCssLs,
		getStylesheet: services.getStylesheet
	});
	const jsonPlugin = useJsonPlugin({
		getJsonLs: () => jsonLs,
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
	const vueTsPlugins = [
		vueTs.useHtmlPlugin(),
		vueTs.usePugPlugin(),
	];

	const context: DocumentServiceRuntimeContext = {
		typescript: ts,
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
				tsLs = sharedServices.getDummyTsLs(context.typescript, ts2, document, tsSettings);
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

		let vueDoc = vueDocuments.get(document);

		if (vueDoc) {

			if (vueDoc.file.getVersion() !== document.version.toString()) {
				vueDoc.file.update(document.getText(), document.version.toString());
			}

			return vueDoc;
		}

		const vueFile = vueTs.createVueFile(
			shared.uriToFsPath(document.uri),
			document.getText(),
			document.version.toString(),
			vueTsPlugins,
			{},
			context.typescript,
			services.getCssVBindRanges,
			services.getCssClasses,
		);
		vueDoc = parseVueDocument(vueFile);

		vueDocuments.set(document, vueDoc);

		return vueDoc;
	}
}

function patchHtmlFormat(htmlPlugin: EmbeddedLanguageServicePlugin) {

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
