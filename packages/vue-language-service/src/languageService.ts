import * as shared from '@volar/shared';
import * as ts2 from '@volar/typescript-language-service';
import { createBasicRuntime, createTypeScriptRuntime } from '@volar/vue-typescript';
import { isGloballyWhitelisted } from '@vue/shared';
import * as vscode from 'vscode-languageserver-protocol';
import useCssPlugin, { triggerCharacters as cssTriggerCharacters } from './commonPlugins/css';
import useDirectiveCommentPlugin, { triggerCharacters as directiveCommentTriggerCharacters } from './commonPlugins/directiveComment';
import useEmmetPlugin, { triggerCharacters as emmetTriggerCharacters } from './commonPlugins/emmet';
import useHtmlPlugin, { triggerCharacters as htmlTriggerCharacters } from './commonPlugins/html';
import useJsDocPlugin, { triggerCharacters as jsDocTriggerCharacters } from './commonPlugins/jsDoc';
import useJsonPlugin, { triggerCharacters as jsonTriggerCharacters } from './commonPlugins/json';
import usePugPlugin, { triggerCharacters as pugTriggerCharacters } from './commonPlugins/pug';
import useTsPlugin, { getSemanticTokenLegend as getTsSemanticTokenLegend, getTriggerCharacters as getTsTriggerCharacters } from './commonPlugins/typescript';
import * as d3 from './ideFeatures/d3';
import * as tagNameCase from './ideFeatures/tagNameCase';
import * as autoInsert from './languageFuatures/autoInsert';
import * as callHierarchy from './languageFuatures/callHierarchy';
import * as codeActionResolve from './languageFuatures/codeActionResolve';
import * as codeActions from './languageFuatures/codeActions';
import * as codeLens from './languageFuatures/codeLens';
import * as codeLensResolve from './languageFuatures/codeLensResolve';
import * as completions from './languageFuatures/complete';
import * as completionResolve from './languageFuatures/completeResolve';
import * as definition from './languageFuatures/definition';
import * as documentHighlight from './languageFuatures/documentHighlights';
import * as documentLink from './languageFuatures/documentLinks';
import * as semanticTokens from './languageFuatures/documentSemanticTokens';
import * as executeCommand from './languageFuatures/executeCommand';
import * as fileRename from './languageFuatures/fileRename';
import * as hover from './languageFuatures/hover';
import * as references from './languageFuatures/references';
import * as rename from './languageFuatures/rename';
import * as renamePrepare from './languageFuatures/renamePrepare';
import * as signatureHelp from './languageFuatures/signatureHelp';
import * as diagnostics from './languageFuatures/validation';
import * as workspaceSymbol from './languageFuatures/workspaceSymbols';
import { LanguageServiceHost, LanguageServiceRuntimeContext } from './types';
import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';
import useAutoDotValuePlugin from './vuePlugins/autoCompleteRefs';
import useHtmlPugConversionsPlugin from './vuePlugins/htmlPugConversions';
import useReferencesCodeLensPlugin from './vuePlugins/referencesCodeLens';
import useRefSugarConversionsPlugin from './vuePlugins/refSugarConversions';
import useScriptSetupConversionsPlugin from './vuePlugins/scriptSetupConversions';
import useTagNameCasingConversionsPlugin from './vuePlugins/tagNameCasingConversions';
import useVuePlugin, { triggerCharacters as vueTriggerCharacters } from './vuePlugins/vue';
import useVueTemplateLanguagePlugin, { semanticTokenTypes as vueTemplateSemanticTokenTypes, triggerCharacters as vueTemplateLanguageTriggerCharacters } from './vuePlugins/vueTemplateLanguage';

import type * as _0 from 'vscode-html-languageservice';
import type * as _1 from 'vscode-css-languageservice';

export interface LanguageService extends ReturnType<typeof createLanguageService> { }

export type LanguageServicePlugin = ReturnType<typeof defineLanguageServicePlugin>;

let pluginId = 0;

function defineLanguageServicePlugin(plugin: EmbeddedLanguagePlugin, context?: {
	isAdditionalCompletion?: boolean,
	triggerCharacters?: string[],
}) {
	return {
		id: pluginId++,
		...plugin,
		context,
	};
}

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

export function getTriggerCharacters(tsVersion: string) {
	return [...new Set([
		...vueTriggerCharacters,
		...getTsTriggerCharacters(tsVersion),
		...jsonTriggerCharacters,
		...jsDocTriggerCharacters,
		...cssTriggerCharacters,
		...htmlTriggerCharacters,
		...pugTriggerCharacters,
		...directiveCommentTriggerCharacters,
		...emmetTriggerCharacters,
		...vueTemplateLanguageTriggerCharacters,
	])];
}

export function createLanguageService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') },
	vueHost: LanguageServiceHost,
	getSettings?: <T> (section: string, scopeUri?: string) => Promise<T | undefined>,
	getNameCases?: (uri: string) => Promise<{
		tag: 'both' | 'kebabCase' | 'pascalCase',
		attr: 'kebabCase' | 'camelCase',
	}>,
) {

	const compilerOptions = vueHost.getVueCompilationSettings?.() ?? {};
	const services = createBasicRuntime();
	const tsRuntime = createTypeScriptRuntime({
		typescript: ts,
		...services,
		compilerOptions,
	}, vueHost, false);
	const blockingRequests = new Set<Promise<any>>();
	const tsTriggerCharacters = getTsTriggerCharacters(ts.version);

	// plugins
	const _getSettings: <T>(section: string, scopeUri?: string | undefined) => Promise<T | undefined> = async (section, scopeUri) => getSettings?.(section, scopeUri);
	const customPlugins = loadCustomPlugins(vueHost.getCurrentDirectory()).map(plugin => defineLanguageServicePlugin(plugin));
	const vuePlugin = defineLanguageServicePlugin(
		useVuePlugin({
			getSettings: _getSettings,
			getVueDocument: (document) => tsRuntime.context.vueDocuments.get(document.uri),
			scriptTsLs: tsRuntime.context.scriptTsLs,
			documentContext: tsRuntime.context.documentContext,
		}),
		{
			triggerCharacters: vueTriggerCharacters,
		},
	);
	const vueTemplateHtmlPlugin = _useVueTemplateLanguagePlugin(
		'html',
		useHtmlPlugin({
			getSettings: _getSettings,
			getHtmlLs: () => services.htmlLs,
			documentContext: tsRuntime.context.documentContext,
		}),
		htmlTriggerCharacters,
	);
	const vueTemplatePugPlugin = _useVueTemplateLanguagePlugin(
		'jade',
		usePugPlugin({
			getSettings: _getSettings,
			getPugLs: () => services.pugLs,
			documentContext: tsRuntime.context.documentContext,
		}),
		pugTriggerCharacters,
	);
	const cssPlugin = defineLanguageServicePlugin(
		useCssPlugin({
			getSettings: _getSettings,
			getCssLs: services.getCssLs,
			getStylesheet: services.getStylesheet,
			documentContext: tsRuntime.context.documentContext,
		}),
		{
			triggerCharacters: cssTriggerCharacters,
		},
	);
	const jsonPlugin = defineLanguageServicePlugin(
		useJsonPlugin({
			getJsonLs: () => services.jsonLs,
			schema: undefined, // TODO
		}),
		{
			triggerCharacters: cssTriggerCharacters,
		},
	);
	const emmetPlugin = defineLanguageServicePlugin(
		useEmmetPlugin({
			getSettings: _getSettings,
		}),
		{
			triggerCharacters: emmetTriggerCharacters,
			isAdditionalCompletion: true,
		},
	);
	const scriptTsPlugins = useTsPlugins(
		tsRuntime.context.scriptTsLs,
		false,
		{
			// includeCompletionsForModuleExports: true, // set in server/src/tsConfigs.ts
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
		},
	)
	const templateTsPlugins = useTsPlugins(
		tsRuntime.context.templateTsLs,
		true,
		{
			// includeCompletionsForModuleExports: true, // set in server/src/tsConfigs.ts
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
			quotePreference: 'single',
			includeCompletionsForModuleExports: false,
			includeCompletionsForImportStatements: false,
		},
	)
	const autoDotValuePlugin = defineLanguageServicePlugin(
		useAutoDotValuePlugin({
			getSettings: _getSettings,
			ts,
			getTsLs: () => tsRuntime.context.scriptTsLs,
		}),
	);
	const referencesCodeLensPlugin = defineLanguageServicePlugin(
		useReferencesCodeLensPlugin({
			getSettings: _getSettings,
			getVueDocument: (uri) => tsRuntime.context.vueDocuments.get(uri),
			findReference: async (...args) => findReferences_internal(...args),
		}),
	);
	const htmlPugConversionsPlugin = defineLanguageServicePlugin(
		useHtmlPugConversionsPlugin({
			getSettings: _getSettings,
			getVueDocument: (uri) => tsRuntime.context.vueDocuments.get(uri),
		}),
	);
	const scriptSetupConversionsPlugin = defineLanguageServicePlugin(
		useScriptSetupConversionsPlugin({
			getSettings: _getSettings,
			ts,
			getVueDocument: (uri) => tsRuntime.context.vueDocuments.get(uri),
			doCodeActions: async (...args) => doCodeActions_internal(...args),
			doCodeActionResolve: async (...args) => doCodeActionResolve_internal(...args),
		}),
	);
	const refSugarConversionsPlugin = defineLanguageServicePlugin(
		useRefSugarConversionsPlugin({
			getSettings: _getSettings,
			ts,
			getVueDocument: (uri) => tsRuntime.context.vueDocuments.get(uri),
			doCodeActions: async (...args) => doCodeActions_internal(...args),
			doCodeActionResolve: async (...args) => doCodeActionResolve_internal(...args),
			findReferences: async (...args) => findReferences_internal(...args),
			doValidation: async (...args) => doValidation_internal(...args),
			doRename: async (...args) => doRename_internal(...args),
			findTypeDefinition: async (...args) => findTypeDefinition_internal(...args),
			scriptTsLs: tsRuntime.context.scriptTsLs,
		}),
	);
	const tagNameCasingConversionsPlugin = defineLanguageServicePlugin(
		useTagNameCasingConversionsPlugin({
			getVueDocument: (uri) => tsRuntime.context.vueDocuments.get(uri),
			findReferences: async (...args) => findReferences_internal(...args),
		}),
	);

	const allPlugins = new Map<number, LanguageServicePlugin>();

	for (const plugin of [
		...customPlugins,
		vuePlugin,
		cssPlugin,
		vueTemplateHtmlPlugin,
		vueTemplatePugPlugin,
		jsonPlugin,
		emmetPlugin,
		autoDotValuePlugin,
		referencesCodeLensPlugin,
		htmlPugConversionsPlugin,
		scriptSetupConversionsPlugin,
		refSugarConversionsPlugin,
		tagNameCasingConversionsPlugin,
		...scriptTsPlugins,
		...templateTsPlugins,
	]) {
		allPlugins.set(plugin.id, plugin);
	}

	const context: LanguageServiceRuntimeContext = {
		...services,
		...tsRuntime.context,
		typescript: ts,
		compilerOptions,
		getTextDocument: tsRuntime.getHostDocument,
		getPlugins: lsType => {
			let plugins = [
				...customPlugins,
				vuePlugin,
				cssPlugin,
				vueTemplateHtmlPlugin,
				vueTemplatePugPlugin,
				jsonPlugin,
				emmetPlugin,
				referencesCodeLensPlugin,
				htmlPugConversionsPlugin,
				scriptSetupConversionsPlugin,
				refSugarConversionsPlugin,
				tagNameCasingConversionsPlugin,
			];
			if (lsType === 'template') {
				plugins = plugins.concat(templateTsPlugins);
			}
			else if (lsType === 'script') {
				plugins = plugins.concat(scriptTsPlugins);
				plugins.push(autoDotValuePlugin);
			}
			return plugins;
		},
		getPluginById: id => allPlugins.get(id),
	};
	const _callHierarchy = callHierarchy.register(context);
	const findReferences_internal = defineInternalApi(references.register(context), true);
	const doCodeActions_internal = defineInternalApi(codeActions.register(context), false);
	const doCodeActionResolve_internal = defineInternalApi(codeActionResolve.register(context), false);
	const doValidation_internal = defineInternalApi(diagnostics.register(context, () => tsRuntime.update(true)), false);
	const doRename_internal = defineInternalApi(rename.register(context), true);
	const findTypeDefinition_internal = defineInternalApi(definition.register(context, 'findTypeDefinition', data => !!data.capabilities.definitions, data => !!data.capabilities.definitions), isTemplateScriptPosition);

	return {
		doValidation: defineApi(diagnostics.register(context, () => tsRuntime.update(true)), false, false),
		findReferences: defineApi(references.register(context), true),
		findDefinition: defineApi(definition.register(context, 'findDefinition', data => !!data.capabilities.definitions, data => !!data.capabilities.definitions), isTemplateScriptPosition),
		findTypeDefinition: defineApi(definition.register(context, 'findTypeDefinition', data => !!data.capabilities.definitions, data => !!data.capabilities.definitions), isTemplateScriptPosition),
		findImplementations: defineApi(definition.register(context, 'findImplementations', data => !!data.capabilities.references, data => false), false),
		prepareRename: defineApi(renamePrepare.register(context), isTemplateScriptPosition),
		doRename: defineApi(rename.register(context), true),
		getEditsForFileRename: defineApi(fileRename.register(context), false),
		getSemanticTokens: defineApi(semanticTokens.register(context), false),
		doHover: defineApi(hover.register(context), isTemplateScriptPosition),
		doComplete: defineApi(completions.register(context), isTemplateScriptPosition),
		doCodeActions: defineApi(codeActions.register(context), false),
		doCodeActionResolve: defineApi(codeActionResolve.register(context), false),
		doCompletionResolve: defineApi(completionResolve.register(context), false),
		getSignatureHelp: defineApi(signatureHelp.register(context), false),
		doCodeLens: defineApi(codeLens.register(context), false),
		doCodeLensResolve: defineApi(codeLensResolve.register(context), false),
		findDocumentHighlights: defineApi(documentHighlight.register(context), false),
		findDocumentLinks: defineApi(documentLink.register(context), false),
		findWorkspaceSymbols: defineApi(workspaceSymbol.register(context), false),
		doAutoInsert: defineApi(autoInsert.register(context), false),
		doExecuteCommand: defineApi(executeCommand.register(context), false),
		callHierarchy: {
			doPrepare: defineApi(_callHierarchy.doPrepare, isTemplateScriptPosition),
			getIncomingCalls: defineApi(_callHierarchy.getIncomingCalls, true),
			getOutgoingCalls: defineApi(_callHierarchy.getOutgoingCalls, true),
		},
		dispose: () => {
			tsRuntime.dispose();
		},
		updateHtmlCustomData: services.updateHtmlCustomData,
		updateCssCustomData: services.updateCssCustomData,

		__internal__: {
			tsRuntime,
			rootPath: vueHost.getCurrentDirectory(),
			context,
			getContext: defineApi(() => context, true),
			getD3: defineApi(d3.register(context), true),
			detectTagNameCase: defineApi(tagNameCase.register(context), true),
		},
	};

	function _useVueTemplateLanguagePlugin(languageId: string, templateLanguagePlugin: EmbeddedLanguagePlugin, triggerCharacters: string[]) {
		return defineLanguageServicePlugin(
			useVueTemplateLanguagePlugin({
				getSettings: _getSettings,
				ts,
				htmlLs: services.htmlLs,
				getSemanticTokenLegend,
				getScanner: (document) => {
					if (document.languageId === 'html') {
						return services.htmlLs.createScanner(document.getText());
					}
					else if (document.languageId === 'jade') {
						const pugDocument = services.getPugDocument(document);
						if (pugDocument) {
							return services.pugLs.createScanner(pugDocument);
						}
					}
				},
				scriptTsLs: tsRuntime.context.scriptTsLs,
				templateTsLs: tsRuntime.context.templateTsLs,
				templateLanguagePlugin: templateLanguagePlugin,
				isSupportedDocument: (document) => document.languageId === languageId,
				getNameCases,
				getScriptContentVersion: tsRuntime.getScriptContentVersion,
				getHtmlDataProviders: services.getHtmlDataProviders,
				vueHost,
				vueDocuments: tsRuntime.context.vueDocuments,
				updateTemplateScripts: () => tsRuntime.update(true),
			}),
			{
				triggerCharacters: [...triggerCharacters, ...vueTemplateLanguageTriggerCharacters],
			},
		);
	}
	function useTsPlugins(tsLs: ts2.LanguageService, isTemplatePlugin: boolean, baseCompletionOptions: ts.GetCompletionsAtPositionOptions) {
		const _languageSupportPlugin = defineLanguageServicePlugin(
			useTsPlugin({
				getTsLs: () => tsLs,
				baseCompletionOptions,
			}),
			{
				triggerCharacters: tsTriggerCharacters,
			},
		);
		const languageSupportPlugin: LanguageServicePlugin = isTemplatePlugin ? {
			..._languageSupportPlugin,
			async doComplete(textDocument, position, context) {

				const tsComplete = await _languageSupportPlugin.doComplete?.(textDocument, position, context);

				if (tsComplete) {
					const sortTexts = shared.getTsCompletions(ts)?.SortText;
					if (sortTexts) {
						tsComplete.items = tsComplete.items.filter(tsItem => {
							if (
								(sortTexts.GlobalsOrKeywords !== undefined && tsItem.sortText === sortTexts.GlobalsOrKeywords)
								|| (sortTexts.DeprecatedGlobalsOrKeywords !== undefined && tsItem.sortText === sortTexts.DeprecatedGlobalsOrKeywords)
							) {
								return isGloballyWhitelisted(tsItem.label);
							}
							return true;
						});
					}
				}

				return tsComplete;
			},
		} : _languageSupportPlugin;
		const jsDocPlugin = defineLanguageServicePlugin(
			useJsDocPlugin({
				getTsLs: () => tsLs,
			}),
			{
				triggerCharacters: jsDocTriggerCharacters,
				isAdditionalCompletion: true,
			},
		);
		const directiveCommentPlugin = defineLanguageServicePlugin(
			useDirectiveCommentPlugin({
				getTsLs: () => tsLs,
			}),
			{
				triggerCharacters: directiveCommentTriggerCharacters,
				isAdditionalCompletion: true,
			},
		);
		return [
			languageSupportPlugin,
			jsDocPlugin,
			directiveCommentPlugin,
		];
	}
	function isTemplateScriptPosition(uri: string, pos: vscode.Position) {

		const sourceFile = tsRuntime.context.vueDocuments.get(uri);
		if (!sourceFile) {
			return false;
		}

		for (const sourceMap of sourceFile.getTsSourceMaps()) {
			if (sourceMap.lsType === 'script')
				continue;
			for (const _ of sourceMap.getMappedRanges(pos, pos, data =>
				data.vueTag === 'template'
				|| data.vueTag === 'style' // handle CSS variable injection to fix https://github.com/johnsoncodehk/volar/issues/777
			)) {
				return true;
			}
		}

		for (const sourceMap of sourceFile.getTemplateSourceMaps()) {
			for (const _ of sourceMap.getMappedRanges(pos)) {
				return true;
			}
		}

		return false;
	}
	function defineApi<T extends (...args: any) => any>(
		api: T,
		shouldUpdateTemplateScript: boolean | ((...args: Parameters<T>) => boolean),
		blockNewRequest = true,
	): (...args: Parameters<T>) => Promise<ReturnType<T>> {
		const handler = {
			async apply(target: (...args: any) => any, thisArg: any, argumentsList: Parameters<T>) {
				for (const runningRequest of blockingRequests) {
					await runningRequest;
				}
				const _shouldUpdateTemplateScript = typeof shouldUpdateTemplateScript === 'boolean' ? shouldUpdateTemplateScript : shouldUpdateTemplateScript.apply(null, argumentsList);
				tsRuntime.update(_shouldUpdateTemplateScript);
				const runner = target.apply(thisArg, argumentsList);
				if (blockNewRequest && runner instanceof Promise) {
					blockingRequests.add(runner);
					runner.then(() => blockingRequests.delete(runner));
				}
				return runner;
			}
		};
		return new Proxy<T>(api, handler);
	}
	function defineInternalApi<T extends (...args: any) => any>(
		api: T,
		shouldUpdateTemplateScript: boolean | ((...args: Parameters<T>) => boolean),
	): (...args: Parameters<T>) => Promise<ReturnType<T>> {
		const handler = {
			async apply(target: (...args: any) => any, thisArg: any, argumentsList: Parameters<T>) {
				const _shouldUpdateTemplateScript = typeof shouldUpdateTemplateScript === 'boolean' ? shouldUpdateTemplateScript : shouldUpdateTemplateScript.apply(null, argumentsList);
				tsRuntime.update(_shouldUpdateTemplateScript);
				return target.apply(thisArg, argumentsList);
			}
		};
		return new Proxy<T>(api, handler);
	}
}

export function loadCustomPlugins(dir: string) {
	try {
		const configPath = require.resolve('./volar.config.js', { paths: [dir] });
		const config: { plugins?: EmbeddedLanguagePlugin[] } = require(configPath);
		return config.plugins ?? []
	}
	catch (err) {
		console.log('load volar.config.js failed in', dir);
		return [];
	}
}
