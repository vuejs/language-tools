import * as shared from '@volar/shared';
import * as ts2 from '@volar/typescript-language-service';
import { ConfigurationHost, EmbeddedLanguageServicePlugin, setCurrentConfigurationHost } from '@volar/vue-language-service-types';
import * as vue from '@volar/vue-language-core';
import type * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import useCssPlugin from './plugins/css';
import useHtmlPlugin from './plugins/html';
import useJsonPlugin from './plugins/json';
import usePugPlugin from './plugins/pug';
import usePugFormatPlugin from './plugins/pug-beautify';
import useTsPlugin, { isTsDocument } from './plugins/typescript';
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
import useAutoWrapParenthesesPlugin from './plugins/vue-autoinsert-parentheses';
import useVuePlugin from './plugins/vue';
import type * as _ from 'vscode-languageserver-protocol';

export interface DocumentService extends ReturnType<typeof getDocumentService> { }

export function getDocumentService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	configurationHost: ConfigurationHost | undefined,
	fileSystemProvider: html.FileSystemProvider | undefined,
	customPlugins: EmbeddedLanguageServicePlugin[],
) {

	setCurrentConfigurationHost(configurationHost); // TODO

	const vueDocuments = new WeakMap<TextDocument, VueDocument>();
	const tsSettings = getTsSettings(configurationHost);

	let tsLs: ts2.LanguageService;

	// language support plugins
	const vuePlugin = useVuePlugin({
		ts,
		getVueDocument: doc => vueDocuments.get(doc),
		tsLs: undefined,
		isJsxMissing: false,
	});
	const htmlPlugin = useHtmlPlugin({
		fileSystemProvider,
	});
	const pugPlugin = usePugPlugin({
		configurationHost,
		htmlPlugin,
	});
	const cssPlugin = useCssPlugin({
		fileSystemProvider,
	});
	const jsonPlugin = useJsonPlugin({});
	const tsPlugin = useTsPlugin({
		tsVersion: ts.version,
		getTsLs: () => tsLs,
	});
	const autoWrapParenthesesPlugin = useAutoWrapParenthesesPlugin({
		ts,
		getVueDocument: doc => vueDocuments.get(doc),
	});

	// formatter plugins
	const pugFormatPlugin = usePugFormatPlugin();
	const formatPlugns = [
		...customPlugins,
		cssPlugin,
		htmlPlugin,
		pugFormatPlugin,
		jsonPlugin,
		tsPlugin,
	].map(patchHtmlFormat);

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

		let vueDoc = vueDocuments.get(document);

		if (vueDoc) {

			vueDoc.file.text = document.getText();

			return vueDoc;
		}

		const vueFile = vue.createSourceFile(
			'/untitled.' + shared.languageIdToSyntax(document.languageId),
			document.getText(),
			{},
			{},
			context.typescript,
		);
		vueDoc = parseVueDocument(vueFile, undefined);

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
				const result = await originalFormat?.(patchDocument, {
					start: patchDocument.positionAt(0),
					end: patchDocument.positionAt(patchDocument.getText().length),
				}, options);

				if (!result?.length)
					return result;

				let newText = TextDocument.applyEdits(patchDocument, result);
				newText = newText.trim();
				newText = newText.substring(prefixes.length, newText.length - suffixes.length);

				return [{
					newText,
					range: {
						start: document.positionAt(0),
						end: document.positionAt(document.getText().length),
					}
				}];
			}

			return originalFormat?.(document, range, options);
		};
	}

	return htmlPlugin;
}
