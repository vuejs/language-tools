import useCssPlugin from '@volar-plugins/css';
import useEmmetPlugin from '@volar-plugins/emmet';
import useHtmlPlugin from '@volar-plugins/html';
import useJsonPlugin from '@volar-plugins/json';
import usePugPlugin from '@volar-plugins/pug';
import useTsPlugin from '@volar-plugins/typescript';
import * as embedded from '@volar/language-core';
import * as embeddedLS from '@volar/language-service';
import * as ts2 from '@volar/typescript-language-service';
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

	const tsLegend = ts2.getSemanticTokenLegend();
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
	const vueTemplateHtmlPlugin = _useVueTemplateLanguagePlugin(
		'html',
		useHtmlPlugin(),
	);
	const vueTemplatePugPlugin = _useVueTemplateLanguagePlugin(
		'jade',
		usePugPlugin(),
	);
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

	return [
		vuePlugin,
		cssPlugin,
		vueTemplateHtmlPlugin,
		vueTemplatePugPlugin,
		jsonPlugin,
		referencesCodeLensPlugin,
		htmlPugConversionsPlugin,
		scriptSetupConversionsPlugin,
		refSugarConversionsPlugin,
		tsPlugin,
		autoDotValuePlugin,
		// put emmet plugin last to fix https://github.com/johnsoncodehk/volar/issues/1088
		emmetPlugin,
	];

	function _useVueTemplateLanguagePlugin<T extends ReturnType<typeof useHtmlPlugin> | ReturnType<typeof usePugPlugin>>(languageId: string, templateLanguagePlugin: T) {
		return useVueTemplateLanguagePlugin({
			templateLanguagePlugin,
			getSemanticTokenLegend,
			getScanner: (document): html.Scanner | undefined => {
				if (document.languageId === 'html') {
					return templateLanguagePlugin.getHtmlLs().createScanner(document.getText());
				}
				else if (document.languageId === 'jade') {
					const pugDocument = 'getPugDocument' in templateLanguagePlugin ? templateLanguagePlugin.getPugDocument(document) : undefined;
					if (pugDocument) {
						return 'getPugLs' in templateLanguagePlugin ? templateLanguagePlugin.getPugLs().createScanner(pugDocument) : undefined;
					}
				}
			},
			isSupportedDocument: (document) =>
				document.languageId === languageId
				&& !apis.context.documents.get(document.uri) /* not petite-vue source file */,
			vueLsHost: host,
			context: apis.context,
		});
	}
}

export function createLanguageService(
	host: LanguageServiceHost,
	env: embeddedLS.PluginContext['env'],
) {

	const vueLanguageModule = vue.createEmbeddedLanguageModule(
		host.getTypeScriptModule(),
		host.getCurrentDirectory(),
		host.getCompilationSettings(),
		host.getVueCompilationSettings(),
	);
	const core = embedded.createEmbeddedLanguageServiceHost(host, [vueLanguageModule]);
	const languageServiceContext = embeddedLS.createLanguageServiceContext({
		env,
		host,
		context: core,
		getPlugins() {
			return getLanguageServicePlugins(host, languageService);
		},
	});
	const languageService = embeddedLS.createLanguageService(languageServiceContext);

	return languageService;
}
