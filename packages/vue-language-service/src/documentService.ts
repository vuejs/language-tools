import useCssPlugin from '@volar-plugins/css';
import useHtmlPlugin from '@volar-plugins/html';
import useJsonPlugin from '@volar-plugins/json';
import usePugPlugin from '@volar-plugins/pug';
import usePugFormatPlugin from '@volar-plugins/pug-beautify';
import useTsPlugin from '@volar-plugins/typescript';
import * as embeddedLS from '@volar/embedded-language-service';
import * as embedded from '@volar/embedded-language-core';
import * as shared from '@volar/shared';
import * as vue from '@volar/vue-language-core';
import { TextDocument } from 'vscode-languageserver-textdocument';
import useVuePlugin from './plugins/vue';
import useAutoWrapParenthesesPlugin from './plugins/vue-autoinsert-parentheses';
import { PluginContext } from '@volar/embedded-language-service';

// fix build
import type * as _0 from 'vscode-languageserver-protocol';

export interface DocumentService extends ReturnType<typeof getDocumentService> { }

export function getDocumentService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	env: PluginContext['env'],
	customPlugins: embeddedLS.EmbeddedLanguageServicePlugin[] = [],
) {

	const vueDocuments = new WeakMap<TextDocument, [embeddedLS.SourceFileDocument, embedded.EmbeddedLanguageModule]>();
	const vueLanguagePlugins = vue.getDefaultVueLanguagePlugins(ts, shared.getPathOfUri(env.rootUri.toString()), {}, {}, []);
	const documentServiceContext = embeddedLS.getDocumentServiceContext({
		ts,
		env,
		getLanguageModules() {
			const vueLanguageModule: embedded.EmbeddedLanguageModule = {
				createSourceFile(fileName, snapshot) {
					return new vue.VueSourceFile(fileName, snapshot, ts, vueLanguagePlugins);
				},
				updateSourceFile(sourceFile: vue.VueSourceFile, snapshot) {
					sourceFile.update(snapshot);
				},
			};
			return [vueLanguageModule];
		},
		getPlugins() {
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
	});
	const documentService = embeddedLS.getDocumentService(documentServiceContext);

	return documentService;
}
