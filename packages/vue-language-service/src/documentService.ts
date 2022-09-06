import * as shared from '@volar/shared';
import { ConfigurationHost, EmbeddedLanguageServicePlugin, setContextStore } from '@volar/common-language-service';
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
import { singleFileTypeScriptServiceHost, updateSingleFileTypeScriptServiceHost } from './utils/singleFileTypeScriptService';
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

	setContextStore({
		rootUri: rootUri.toString(),
		typescript: {
			module: ts,
			languageServiceHost: singleFileTypeScriptServiceHost,
			languageService: ts.createLanguageService(singleFileTypeScriptServiceHost),
		},
		configurationHost,
		fileSystemProvider,
		documentContext: undefined,
	});

	const vueDocuments = new WeakMap<TextDocument, VueDocument>();

	// language support plugins
	const vuePlugin = useVuePlugin({
		getVueDocument: doc => vueDocuments.get(doc),
		tsLs: undefined,
		isJsxMissing: false,
	});
	const htmlPlugin = useHtmlPlugin({});
	const pugPlugin = usePugPlugin();
	const cssPlugin = useCssPlugin();
	const jsonPlugin = useJsonPlugin();
	const tsPlugin = useTsPlugin();
	const autoWrapParenthesesPlugin = useAutoWrapParenthesesPlugin({
		getVueDocument: doc => vueDocuments.get(doc),
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
				updateSingleFileTypeScriptServiceHost(context.typescript, document);
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

		let vueDoc = vueDocuments.get(document);

		if (vueDoc) {

			if (vueDoc.file.text !== document.getText()) {
				vueDoc.file.update(ts.ScriptSnapshot.fromString(document.getText()));
			}

			return vueDoc;
		}

		const vueFile = vue.createSourceFile(
			'/untitled.' + shared.languageIdToSyntax(document.languageId),
			ts.ScriptSnapshot.fromString(document.getText()),
			context.typescript,
			vuePlugins,
		);
		vueDoc = parseVueDocument(rootUri, vueFile, undefined);

		vueDocuments.set(document, vueDoc);

		return vueDoc;
	}
}
