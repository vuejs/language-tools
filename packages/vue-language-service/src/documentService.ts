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
import { DocumentServiceRuntimeContext } from './types';
import { getSingleFileTypeScriptService } from './utils/singleFileTypeScriptService';
import { parseVueDocument, VueDocument } from './vueDocuments';
import useAutoWrapParenthesesPlugin from './plugins/vue-autoinsert-parentheses';
import useVuePlugin from './plugins/vue';
import type * as _ from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';

export interface DocumentService extends ReturnType<typeof getDocumentService> { }

export function getDocumentService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	configurationHost: ConfigurationHost | undefined,
	fileSystemProvider: html.FileSystemProvider | undefined,
	customPlugins: EmbeddedLanguageServicePlugin[],
	rootUri = URI.file(ts.sys.getCurrentDirectory()),
) {

	setCurrentConfigurationHost(configurationHost); // TODO

	const vueDocuments = new WeakMap<TextDocument, [number, VueDocument]>();

	let tsLs: ts2.LanguageService;

	// language support plugins
	const vuePlugin = useVuePlugin({
		ts,
		getVueDocument: doc => vueDocuments.get(doc)?.[1],
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
		getVueDocument: doc => vueDocuments.get(doc)?.[1],
	});
	const pugFormatPlugin = usePugFormatPlugin();

	const context: DocumentServiceRuntimeContext = {
		typescript: ts,
		getVueDocument,
		getPlugins() {
			return [
				...customPlugins,
				vuePlugin,
				htmlPlugin,
				pugPlugin,
				pugFormatPlugin,
				cssPlugin,
				jsonPlugin,
				tsPlugin,
				autoWrapParenthesesPlugin,
			];
		},
		updateTsLs(document) {
			if (isTsDocument(document)) {
				tsLs = getSingleFileTypeScriptService(context.typescript, ts2, document, section => configurationHost?.getConfiguration(section) as any);
			}
		},
	};
	const vuePlugins = vue.getPlugins(ts, '', {}, {}, []);

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

		let vueDocCache = vueDocuments.get(document);

		if (vueDocCache) {

			if (vueDocCache[0] !== document.version) {
				vueDocCache[1].file.update(ts.ScriptSnapshot.fromString(document.getText()));
				vueDocCache[0] = document.version;
			}

			return vueDocCache[1];
		}

		const vueFile = vue.createSourceFile(
			'/untitled.' + shared.languageIdToSyntax(document.languageId),
			ts.ScriptSnapshot.fromString(document.getText()),
			context.typescript,
			vuePlugins,
		);
		vueDocCache = [document.version, parseVueDocument(rootUri, vueFile, undefined)];

		vueDocuments.set(document, vueDocCache);

		return vueDocCache[1];
	}
}
