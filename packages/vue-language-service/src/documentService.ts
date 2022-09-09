import useCssPlugin from '@volar-plugins/css';
import useHtmlPlugin from '@volar-plugins/html';
import useJsonPlugin from '@volar-plugins/json';
import usePugPlugin from '@volar-plugins/pug';
import usePugFormatPlugin from '@volar-plugins/pug-beautify';
import useTsPlugin, { isTsDocument } from '@volar-plugins/typescript';
import { ConfigurationHost, EmbeddedLanguageServicePlugin, setContextStore, DocumentServiceRuntimeContext, getEmbeddedTypeScriptDocumentService, parseSourceFileDocument, SourceFileDocument } from '@volar/embedded-language-service';
import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-core';
import type * as html from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import useVuePlugin from './plugins/vue';
import useAutoWrapParenthesesPlugin from './plugins/vue-autoinsert-parentheses';
import { singleFileTypeScriptServiceHost, updateSingleFileTypeScriptServiceHost } from './utils/singleFileTypeScriptService';

// fix build
import type * as _0 from 'vscode-languageserver-protocol';

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

	const vueDocuments = new WeakMap<TextDocument, SourceFileDocument>();
	const vuePlugins = vue.getDefaultVueLanguagePlugins(ts, shared.getPathOfUri(rootUri.toString()), {}, {}, []);
	const vueLanguageModule: vue.EmbeddedLanguageModule = {
		createSourceFile(fileName, snapshot) {
			return new vue.VueSourceFile(fileName, snapshot, ts, vuePlugins);
		},
		updateSourceFile(sourceFile: vue.VueSourceFile, snapshot) {
			sourceFile.update(snapshot);
		},
	};

	// language support plugins
	const vuePlugin = useVuePlugin({
		getVueDocument: doc => vueDocuments.get(doc),
		tsLs: undefined,
		isJsxMissing: false,
	});
	const htmlPlugin = useHtmlPlugin();
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
		plugins: [
			...customPlugins,
			vuePlugin,
			htmlPlugin,
			pugPlugin,
			pugFormatPlugin,
			cssPlugin,
			jsonPlugin,
			tsPlugin,
			autoWrapParenthesesPlugin,
		],
		getAndUpdateDocument(document) {

			let vueDoc = vueDocuments.get(document);

			if (vueDoc && vueDoc.file.text !== document.getText()) {
				vueLanguageModule.updateSourceFile(vueDoc.file, ts.ScriptSnapshot.fromString(document.getText()));
				return [vueDoc, vueLanguageModule];
			}

			const vueFile = vueLanguageModule.createSourceFile(
				'/untitled.' + shared.languageIdToSyntax(document.languageId),
				ts.ScriptSnapshot.fromString(document.getText()),
			);
			if (!vueFile)
				return;

			vueDoc = parseSourceFileDocument(rootUri, vueFile);

			vueDocuments.set(document, vueDoc);

			return [vueDoc, vueLanguageModule];
		},
		prepareLanguageServices(document) {
			if (isTsDocument(document)) {
				updateSingleFileTypeScriptServiceHost(context.typescript, document);
			}
		},
	};

	return getEmbeddedTypeScriptDocumentService(context);
}
