import useCssPlugin from '@volar-plugins/css';
import useHtmlPlugin from '@volar-plugins/html';
import useJsonPlugin from '@volar-plugins/json';
import usePugPlugin from '@volar-plugins/pug';
import usePugFormatPlugin from '@volar-plugins/pug-beautify';
import useTsPlugin, { isTsDocument } from '@volar-plugins/typescript';
import * as embedded from '@volar/embedded-language-service';
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
import { EmbeddedLanguageModule } from '@volar/vue-language-core';

export interface DocumentService extends ReturnType<typeof getDocumentService> { }

export function getDocumentService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	configurationHost: embedded.ConfigurationHost | undefined,
	fileSystemProvider: html.FileSystemProvider | undefined,
	customPlugins: embedded.EmbeddedLanguageServicePlugin[],
	rootUri = URI.file(ts.sys.getCurrentDirectory()),
) {

	embedded.setPluginContext({
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

	const vueDocuments = new WeakMap<TextDocument, [embedded.SourceFileDocument, EmbeddedLanguageModule]>();
	const vuePlugins = vue.getDefaultVueLanguagePlugins(ts, shared.getPathOfUri(rootUri.toString()), {}, {}, []);
	const languageModules: vue.EmbeddedLanguageModule[] = [{
		createSourceFile(fileName, snapshot) {
			return new vue.VueSourceFile(fileName, snapshot, ts, vuePlugins);
		},
		updateSourceFile(sourceFile: vue.VueSourceFile, snapshot) {
			sourceFile.update(snapshot);
		},
	}];

	// language support plugins
	const vuePlugin = useVuePlugin({
		getVueDocument: doc => vueDocuments.get(doc)?.[0],
		tsLs: undefined,
		isJsxMissing: false,
	});
	const htmlPlugin = useHtmlPlugin();
	const pugPlugin = usePugPlugin();
	const cssPlugin = useCssPlugin();
	const jsonPlugin = useJsonPlugin();
	const tsPlugin = useTsPlugin();
	const autoWrapParenthesesPlugin = useAutoWrapParenthesesPlugin({
		getVueDocument: doc => vueDocuments.get(doc)?.[0],
	});
	const pugFormatPlugin = usePugFormatPlugin();

	const context: embedded.DocumentServiceRuntimeContext = {
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
		getSourceFileDocument(document) {

			let cache = vueDocuments.get(document);

			if (cache && cache[0].file.text !== document.getText()) {
				cache[1].updateSourceFile(cache[0].file, ts.ScriptSnapshot.fromString(document.getText()));
				return cache;
			}

			for (const languageModule of languageModules) {
				const sourceFile = languageModule.createSourceFile(
					'/untitled.' + shared.languageIdToSyntax(document.languageId),
					ts.ScriptSnapshot.fromString(document.getText()),
				);
				if (sourceFile) {
					const sourceFileDoc = embedded.parseSourceFileDocument(rootUri, sourceFile);
					cache = [sourceFileDoc, languageModule];
					vueDocuments.set(document, cache);
					break;
				}
			}

			return cache;
		},
		prepareLanguageServices(document) {
			if (isTsDocument(document)) {
				updateSingleFileTypeScriptServiceHost(ts, document);
			}
		},
	};

	return embedded.getDocumentService(context);
}
