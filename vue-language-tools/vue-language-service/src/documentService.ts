import useCssPlugin from '@volar-plugins/css';
import useHtmlPlugin from '@volar-plugins/html';
import useJsonPlugin from '@volar-plugins/json';
import usePugPlugin from '@volar-plugins/pug';
import usePugFormatPlugin from '@volar-plugins/pug-beautify';
import useTsPlugin from '@volar-plugins/typescript';
import { DocumentServiceRuntimeContext } from '@volar/language-service';
import useVuePlugin from './plugins/vue';
import useAutoWrapParenthesesPlugin from './plugins/vue-autoinsert-parentheses';
import useAutoAddSpacePlugin from './plugins/vue-autoinsert-space';
import * as embeddedLS from '@volar/language-service';
import * as vue from '@volar/vue-language-core';
import * as shared from '@volar/shared';

import type * as _1 from 'vscode-languageserver-protocol';
import type * as _2 from 'vscode-languageserver-textdocument';

export function getDocumentServicePlugins(
	context: DocumentServiceRuntimeContext
) {

	const vuePlugin = useVuePlugin({
		getVueDocument: doc => context.getVirtualDocuments(doc),
	});
	const htmlPlugin = useHtmlPlugin();
	const pugPlugin = usePugPlugin();
	const cssPlugin = useCssPlugin();
	const jsonPlugin = useJsonPlugin();
	const tsPlugin = useTsPlugin();
	const autoWrapParenthesesPlugin = useAutoWrapParenthesesPlugin({
		getVueDocument: doc => context.getVirtualDocuments(doc),
	});
	const autoAddSpacePlugin = useAutoAddSpacePlugin();
	const pugFormatPlugin = usePugFormatPlugin();

	return [
		vuePlugin,
		htmlPlugin,
		pugPlugin,
		pugFormatPlugin,
		cssPlugin,
		jsonPlugin,
		tsPlugin,
		autoWrapParenthesesPlugin,
		autoAddSpacePlugin,
	];
}

export function createDocumentService(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	env: embeddedLS.LanguageServicePluginContext['env'],
) {

	const vueLanguageModule = vue.createLanguageModule(
		ts,
		shared.getPathOfUri(env.rootUri.toString()),
		{},
		{},
	);
	const languageServiceContext = embeddedLS.createDocumentServiceContext({
		ts,
		env,
		getLanguageModules() {
			return [vueLanguageModule];
		},
		getPlugins() {
			return plugins;
		},
	});
	const plugins = getDocumentServicePlugins(languageServiceContext);
	const languageService = embeddedLS.createDocumentService(languageServiceContext);

	return languageService;
}
