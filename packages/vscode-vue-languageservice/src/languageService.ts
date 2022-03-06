import { createBasicRuntime, createTypeScriptRuntime } from '@volar/vue-typescript';
import type * as emmet from '@vscode/emmet-helper';
import { isGloballyWhitelisted } from '@vue/shared';
import type * as css from 'vscode-css-languageservice';
import type * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import * as ts2 from 'vscode-typescript-languageservice';
import * as autoInsert from './languageFuatures/autoInsert';
import * as completions from './languageFuatures/complete';
import * as completionResolve from './languageFuatures/completeResolve';
import * as hover from './languageFuatures/hover';
import * as signatureHelp from './languageFuatures/signatureHelp';
import * as workspaceSymbol from './languageFuatures/workspaceSymbols';
import useAutoDotValuePlugin from './plugins/autoDotValuePlugin';
import useCssPlugin, { triggerCharacters as cssTriggerCharacters } from './plugins/cssPlugin';
import { EmbeddedLanguagePlugin } from './plugins/definePlugin';
import useDirectiveCommentPlugin, { triggerCharacters as directiveCommentTriggerCharacters } from './plugins/directiveCommentPlugin';
import useEmmetPlugin, { triggerCharacters as emmetTriggerCharacters } from './plugins/emmetPlugin';
import useHtmlPlugin, { triggerCharacters as htmlTriggerCharacters } from './plugins/htmlPlugin';
import useJsDocPlugin, { triggerCharacters as jsDocTriggerCharacters } from './plugins/jsDocPlugin';
import useJsonPlugin, { triggerCharacters as jsonTriggerCharacters } from './plugins/jsonPlugin';
import usePugPlugin, { triggerCharacters as pugTriggerCharacters } from './plugins/pugPlugin';
import useTsPlugin, { getTriggerCharacters as getTsTriggerCharacters } from './plugins/tsPlugin';
import useVuePlugin, { triggerCharacters as vueTriggerCharacters } from './plugins/vuePlugin';
import useVueTemplateLanguagePlugin, { getTsCompletions, triggerCharacters as vueTemplateLanguageTriggerCharacters } from './plugins/vueTemplateLanguagePlugin';
import * as callHierarchy from './languageFuatures/callHierarchy';
import * as codeActions from './services/codeAction';
import * as codeActionResolve from './services/codeActionResolve';
import * as d3 from './services/d3';
import * as definitions from './services/definition';
import * as diagnostics from './services/diagnostics';
import * as documentHighlight from './languageFuatures/documentHighlights';
import * as documentLink from './languageFuatures/documentLinks';
import * as references from './services/references';
import * as codeLens from './services/referencesCodeLens';
import * as codeLensResolve from './services/referencesCodeLensResolve';
import * as rename from './services/rename';
import * as semanticTokens from './services/semanticTokens';
import * as tagNameCase from './services/tagNameCase';
import { LanguageServiceHost, LanguageServiceRuntimeContext } from './types';

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
	const vuePlugin = defineLanguageServicePlugin(
		useVuePlugin({
			getVueDocument: (document) => tsRuntime.context.sourceFiles.get(document.uri),
			documentContext: tsRuntime.context.documentContext,
		}),
		{
			triggerCharacters: vueTriggerCharacters,
		},
	);
	const vueTemplateHtmlPlugin = _useVueTemplateLanguagePlugin(
		'html',
		useHtmlPlugin({
			getHtmlLs: () => services.htmlLs,
			getHoverSettings: async (uri) => getSettings?.<html.HoverSettings>('html.hover', uri),
			documentContext: tsRuntime.context.documentContext,
		}),
		htmlTriggerCharacters,
	);
	const vueTemplatePugPlugin = _useVueTemplateLanguagePlugin(
		'jade',
		usePugPlugin({
			getPugLs: () => services.pugLs,
			getHoverSettings: async (uri) => getSettings?.<html.HoverSettings>('html.hover', uri),
			documentContext: tsRuntime.context.documentContext,
		}),
		pugTriggerCharacters,
	);
	const cssPlugin = defineLanguageServicePlugin(
		useCssPlugin({
			getCssLs: services.getCssLs,
			getLanguageSettings: async (languageId, uri) => getSettings?.<css.LanguageSettings>(languageId, uri),
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
			getDocumentLanguageSettings: async () => undefined, // TODO
			schema: undefined, // TODO
		}),
		{
			triggerCharacters: cssTriggerCharacters,
		},
	);
	const emmetPlugin = defineLanguageServicePlugin(
		useEmmetPlugin({
			getEmmetConfig: async () => getSettings?.<emmet.VSCodeEmmetConfig>('emmet'),
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
			ts,
			getTsLs: () => tsRuntime.context.scriptTsLs,
			isEnabled: async () => getSettings?.('volar.autoCompleteRefs'),
		}),
	);

	const allPlugins = new Map<number, LanguageServicePlugin>();

	for (const plugin of [
		vuePlugin,
		cssPlugin,
		vueTemplateHtmlPlugin,
		vueTemplatePugPlugin,
		jsonPlugin,
		emmetPlugin,
		autoDotValuePlugin,
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
				vuePlugin,
				cssPlugin,
				vueTemplateHtmlPlugin,
				vueTemplatePugPlugin,
				jsonPlugin,
				emmetPlugin,
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
	const findDefinition = definitions.register(context);
	const renames = rename.register(context);

	return {
		doValidation: defineApi(diagnostics.register(context, () => tsRuntime.update(true)), false, false),
		findDefinition: defineApi(findDefinition.on, isTemplateScriptPosition),
		findReferences: defineApi(references.register(context), true),
		findTypeDefinition: defineApi(findDefinition.onType, isTemplateScriptPosition),
		prepareRename: defineApi(renames.prepareRename, isTemplateScriptPosition),
		doRename: defineApi(renames.doRename, true),
		getEditsForFileRename: defineApi(renames.onRenameFile, false),
		getSemanticTokens: defineApi(semanticTokens.register(context, () => tsRuntime.update(true)), false),
		doHover: defineApi(hover.register(context), isTemplateScriptPosition),
		doComplete: defineApi(completions.register(context), isTemplateScriptPosition),
		getCodeActions: defineApi(codeActions.register(context), false),
		doCodeActionResolve: defineApi(codeActionResolve.register(context), false),
		doCompletionResolve: defineApi(completionResolve.register(context), false),
		doReferencesCodeLensResolve: defineApi(codeLensResolve.register(context), false),
		getSignatureHelp: defineApi(signatureHelp.register(context), false),
		getReferencesCodeLens: defineApi(codeLens.register(context), false),
		findDocumentHighlights: defineApi(documentHighlight.register(context), false),
		findDocumentLinks: defineApi(documentLink.register(context), false),
		findWorkspaceSymbols: defineApi(workspaceSymbol.register(context), false),
		doAutoInsert: defineApi(autoInsert.register(context), false),
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
				ts,
				htmlLs: services.htmlLs,
				scriptTsLs: tsRuntime.context.scriptTsLs,
				templateTsLs: tsRuntime.context.templateTsLs,
				templateLanguagePlugin: templateLanguagePlugin,
				isSupportedDocument: (document) => document.languageId === languageId,
				getNameCases,
				getScriptContentVersion: tsRuntime.getScriptContentVersion,
				isEnabledComponentAutoImport: async () => (await getSettings?.('volar.completion.autoImportComponent')) ?? true,
				getHtmlDataProviders: services.getHtmlDataProviders,
				vueHost,
				vueDocuments: tsRuntime.context.sourceFiles,
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
					const sortTexts = getTsCompletions(ts)?.SortText;
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

		const sourceFile = tsRuntime.context.sourceFiles.get(uri);
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
}
