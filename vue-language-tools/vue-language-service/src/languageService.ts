import useCssPlugin from '@volar-plugins/css';
import useEmmetPlugin from '@volar-plugins/emmet';
import useHtmlPlugin from '@volar-plugins/html';
import useJsonPlugin from '@volar-plugins/json';
import usePugPlugin from '@volar-plugins/pug';
import useTsPlugin from '@volar-plugins/typescript';
import * as embedded from '@volar/language-core';
import * as embeddedLS from '@volar/language-service';
import { getSemanticTokenLegend as getTsSemanticTokenLegend } from '@volar-plugins/typescript/out/createLangaugeService';
import * as vue from '@volar/vue-language-core';
import { LanguageServiceHost } from '@volar/vue-language-core';
import type * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import useVuePlugin from './plugins/vue';
import useAutoDotValuePlugin from './plugins/vue-autoinsert-dotvalue';
import useReferencesCodeLensPlugin from './plugins/vue-codelens-references';
import useHtmlPugConversionsPlugin from './plugins/vue-convert-htmlpug';
import useRefSugarConversionsPlugin from './plugins/vue-convert-refsugar';
import useScriptSetupConversionsPlugin from './plugins/vue-convert-scriptsetup';
import useVueTemplateLanguagePlugin, { semanticTokenTypes as vueTemplateSemanticTokenTypes } from './plugins/vue-template';

export function getSemanticTokenLegend() {

	const tsLegend = getTsSemanticTokenLegend();
	const tokenTypesLegend = [
		...tsLegend.tokenTypes,
		...vueTemplateSemanticTokenTypes,
	];
	const semanticTokenLegend: vscode.SemanticTokensLegend = {
		tokenTypes: tokenTypesLegend,
		tokenModifiers: tsLegend.tokenModifiers,
	};

	return semanticTokenLegend;
}

export function getLanguageServicePlugins(
	host: vue.LanguageServiceHost,
	apis: embeddedLS.LanguageService,
) {

	// plugins
	const tsPlugin = useTsPlugin();
	const vuePlugin = useVuePlugin({
		getVueDocument: (document) => apis.context.documents.get(document.uri),
	});
	const cssPlugin = useCssPlugin();
	const jsonPlugin = useJsonPlugin();
	const emmetPlugin = useEmmetPlugin();
	const autoDotValuePlugin = useAutoDotValuePlugin();
	const referencesCodeLensPlugin = useReferencesCodeLensPlugin({
		getVueDocument: (uri) => apis.context.documents.get(uri),
		findReference: apis.findReferences,
	});
	const htmlPugConversionsPlugin = useHtmlPugConversionsPlugin({
		getVueDocument: (uri) => apis.context.documents.get(uri),
	});
	const scriptSetupConversionsPlugin = useScriptSetupConversionsPlugin({
		getVueDocument: (uri) => apis.context.documents.get(uri),
		doCodeActions: apis.doCodeActions,
		doCodeActionResolve: apis.doCodeActionResolve,
	});
	const refSugarConversionsPlugin = useRefSugarConversionsPlugin({
		getVueDocument: (uri) => apis.context.documents.get(uri),
		doCodeActions: apis.doCodeActions,
		doCodeActionResolve: apis.doCodeActionResolve,
		findReferences: apis.findReferences,
		doValidation: apis.doValidation,
		doRename: apis.doRename,
		findTypeDefinition: apis.findTypeDefinition,
	});

	// template plugins
	const _htmlPlugin = useHtmlPlugin();
	const _pugPlugin = usePugPlugin();
	const htmlPlugin = useVueTemplateLanguagePlugin({
		templateLanguagePlugin: _htmlPlugin,
		getSemanticTokenLegend,
		getScanner: (document): html.Scanner | undefined => {
			return _htmlPlugin.getHtmlLs().createScanner(document.getText());
		},
		isSupportedDocument: (document) => document.languageId === 'html',
		vueLsHost: host,
		context: apis.context,
	});
	const pugPlugin = useVueTemplateLanguagePlugin({
		templateLanguagePlugin: _pugPlugin,
		getSemanticTokenLegend,
		getScanner: (document): html.Scanner | undefined => {
			const pugDocument = _pugPlugin.getPugDocument(document);
			if (pugDocument) {
				return _pugPlugin.getPugLs().createScanner(pugDocument);
			}
		},
		isSupportedDocument: (document) => document.languageId === 'html',
		vueLsHost: host,
		context: apis.context,
	});

	return [
		vuePlugin,
		cssPlugin,
		htmlPlugin,
		pugPlugin,
		jsonPlugin,
		referencesCodeLensPlugin,
		htmlPugConversionsPlugin,
		scriptSetupConversionsPlugin,
		refSugarConversionsPlugin,
		tsPlugin,
		autoDotValuePlugin,
		// put emmet plugin at last to fix https://github.com/johnsoncodehk/volar/issues/1088
		emmetPlugin,
	];
}

export function createLanguageService(
	host: LanguageServiceHost,
	env: embeddedLS.LanguageServicePluginContext['env'],
	documentRegistry?: ts.DocumentRegistry,
) {

	const vueLanguageModule = vue.createLanguageModule(
		host.getTypeScriptModule(),
		host.getCurrentDirectory(),
		host.getCompilationSettings(),
		host.getVueCompilationSettings(),
		['.vue'],
	);
	const core = embedded.createEmbeddedLanguageServiceHost(host, [vueLanguageModule]);
	const languageServiceContext = embeddedLS.createLanguageServiceContext({
		env,
		host,
		context: core,
		getPlugins() {
			return getLanguageServicePlugins(host, languageService);
		},
		documentRegistry,
	});
	const languageService = embeddedLS.createLanguageService(languageServiceContext);

	return languageService;
}
