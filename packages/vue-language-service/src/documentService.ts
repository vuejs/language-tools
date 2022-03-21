import * as shared from '@volar/shared';
import * as ts2 from '@volar/typescript-language-service';
import { ConfigurationHost, EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import * as vueTs from '@volar/vue-typescript';
import type * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createStylesheetExtra } from './stylesheetExtra';
import useCssPlugin from './commonPlugins/css';
import useHtmlPlugin from './commonPlugins/html';
import useJsonPlugin from './commonPlugins/json';
import usePrettierPlugin from './commonPlugins/prettier';
import usePrettyhtmlPlugin from './commonPlugins/prettyhtml';
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
import { getTsSettings } from './tsConfigs';
import { DocumentServiceRuntimeContext } from './types';
import * as sharedServices from './utils/sharedLs';
import { parseVueDocument, VueDocument } from './vueDocuments';
import useAutoWrapParenthesesPlugin from './vuePlugins/autoWrapParentheses';
import useVuePlugin from './vuePlugins/vue';
import type * as _ from 'vscode-languageserver-protocol';

export interface DocumentService extends ReturnType<typeof getDocumentService> { }

export function getDocumentService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') },
	getPrintWidth: (uri: string) => Promise<number>,
	configurationHost: ConfigurationHost | undefined,
	fileSystemProvider: html.FileSystemProvider | undefined,
	customPlugins: EmbeddedLanguageServicePlugin[],
) {

	const vueDocuments = new WeakMap<TextDocument, VueDocument>();
	const tsSettings = getTsSettings(configurationHost);

	let tsLs: ts2.LanguageService;

	// language support plugins
	const vuePlugin = useVuePlugin({
		configurationHost,
		getVueDocument,
		scriptTsLs: undefined,
	});
	const htmlPlugin = useHtmlPlugin({
		configurationHost,
		fileSystemProvider,
	});
	const pugPlugin = usePugPlugin({
		configurationHost,
		htmlPlugin,
	});
	const cssPlugin = useCssPlugin({
		configurationHost,
		fileSystemProvider,
	});
	const jsonPlugin = useJsonPlugin({});
	const tsPlugin = useTsPlugin({
		tsVersion: ts.version,
		getTsLs: () => tsLs,
	});
	const autoWrapParenthesesPlugin = useAutoWrapParenthesesPlugin({
		configurationHost,
		ts,
		getVueDocument,
	});

	// formatter plugins
	const cssFormatPlugin = usePrettierPlugin(['css', 'less', 'scss', 'postcss']);
	const prettyhtmlPlugin = usePrettyhtmlPlugin({ getPrintWidth });
	const pugFormatPlugin = usePugFormatPlugin();
	const sassFormatPlugin = useSassFormatPlugin();
	const formatPlugns = [
		...customPlugins,
		cssFormatPlugin,
		prettyhtmlPlugin, // ignore in browser
		htmlPlugin,
		pugFormatPlugin,
		sassFormatPlugin,
		jsonPlugin,
		tsPlugin,
	].map(patchHtmlFormat);
	const vueTsPlugins = [
		vueTs.useHtmlPlugin(),
		vueTs.usePugPlugin(),
	];

	const stylesheetExtra = createStylesheetExtra(cssPlugin);
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
			'Record<string, string>',
			stylesheetExtra.getCssVBindRanges,
			stylesheetExtra.getCssClasses,
		);
		vueDoc = parseVueDocument(vueFile);

		vueDocuments.set(document, vueDoc);

		return vueDoc;
	}
}

function patchHtmlFormat<T extends EmbeddedLanguageServicePlugin>(htmlPlugin: T) {

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
