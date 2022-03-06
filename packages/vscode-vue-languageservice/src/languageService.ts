import type * as vscode from 'vscode-languageserver-protocol';
import * as callHierarchy from './services/callHierarchy';
import * as codeActions from './services/codeAction';
import * as codeActionResolve from './services/codeActionResolve';
import * as completions from './services/completion';
import * as completionResolve from './services/completionResolve';
import * as d3 from './services/d3';
import * as definitions from './services/definition';
import * as diagnostics from './services/diagnostics';
import * as documentHighlight from './services/documentHighlight';
import * as documentLink from './services/documentLinks';
import * as hover from './services/hover';
import * as references from './services/references';
import * as codeLens from './services/referencesCodeLens';
import * as codeLensResolve from './services/referencesCodeLensResolve';
import * as rename from './services/rename';
import * as semanticTokens from './services/semanticTokens';
import * as signatureHelp from './services/signatureHelp';
import * as tagNameCase from './services/tagNameCase';
import * as workspaceSymbol from './services/workspaceSymbol';
import { LanguageServiceHost, LanguageServiceRuntimeContext } from './types';
import { createBasicRuntime, createTypeScriptRuntime } from '@volar/vue-typescript';

import type * as html from 'vscode-html-languageservice';
import type * as css from 'vscode-css-languageservice';
import type * as json from 'vscode-json-languageservice';
import type * as emmet from '@vscode/emmet-helper';

import useVuePlugin, { triggerCharacters as vueTriggerCharacters } from './plugins/vuePlugin';
import useCssPlugin, { triggerCharacters as cssTriggerCharacters } from './plugins/cssPlugin';
import useHtmlPlugin, { triggerCharacters as _htmlTriggerCharacters } from './plugins/htmlPlugin';
import usePugPlugin, { triggerCharacters as pugTriggerCharacters } from './plugins/pugPlugin';
import useJsonPlugin, { triggerCharacters as jsonTriggerCharacters } from './plugins/jsonPlugin';
import useTsPlugin, { getTriggerCharacters as getTsTriggerCharacters } from './plugins/tsPlugin';
import useJsDocPlugin, { triggerCharacters as jsDocTriggerCharacters } from './plugins/jsDocPlugin';
import useDirectiveCommentPlugin, { triggerCharacters as directiveCommentTriggerCharacters } from './plugins/directiveCommentPlugin';
import useEmmetPlugin, { triggerCharacters as emmetTriggerCharacters } from './plugins/emmetPlugin';
import useAutoDotValuePlugin from './plugins/autoDotValuePlugin';

import { EmbeddedLanguagePlugin } from './plugins/definePlugin';
import { isGloballyWhitelisted } from '@vue/shared';
import { documentRangeFeatureWorker, languageRangeFeatureWorker } from './utils/documentFeatureWorkers';

export interface LanguageService extends ReturnType<typeof createLanguageService> { }

let pluginId = 0;

export type LanguageServicePlugin = ReturnType<typeof wrapPlugin>;

const htmlTriggerCharacter = [
	..._htmlTriggerCharacters,
	'@', // vue event shorthand
];

function wrapPlugin(plugin: EmbeddedLanguagePlugin, context?: {
	useHtmlLs?: boolean,
	isAdditionalCompletion?: boolean,
	isEmmetCompletion?: boolean,
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
		...htmlTriggerCharacter,
		...pugTriggerCharacters,
		...directiveCommentTriggerCharacters,
		...emmetTriggerCharacters,
	])];
}

export function createLanguageService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') },
	vueHost: LanguageServiceHost,
	getSettings: (<T> (section: string, scopeUri?: string) => Promise<T | undefined>) | undefined,
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
	const vuePlugin = wrapPlugin(
		useVuePlugin({
			getVueDocument: (document) => tsRuntime.context.sourceFiles.get(document.uri),
			documentContext: tsRuntime.context.documentContext,
		}),
		{
			triggerCharacters: vueTriggerCharacters,
		},
	);
	const htmlPlugin = wrapPlugin(
		useHtmlPlugin({
			getHtmlLs: () => services.htmlLs,
			getHoverSettings: async (uri) => getSettings?.<html.HoverSettings>('html.hover', uri),
			documentContext: tsRuntime.context.documentContext,
		}),
		{
			useHtmlLs: true,
			triggerCharacters: htmlTriggerCharacter,
		},
	);
	const pugPlugin = wrapPlugin(
		usePugPlugin({
			getPugLs: () => services.pugLs,
			getHoverSettings: async (uri) => getSettings?.<html.HoverSettings>('html.hover', uri),
			documentContext: tsRuntime.context.documentContext,
		}),
		{
			useHtmlLs: true,
			triggerCharacters: pugTriggerCharacters,
		},
	);
	const cssPlugin = wrapPlugin(
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
	const jsonPlugin = wrapPlugin(
		useJsonPlugin({
			getJsonLs: () => services.jsonLs,
			getDocumentLanguageSettings: async () => undefined, // TODO
			schema: undefined, // TODO
		}),
		{
			triggerCharacters: cssTriggerCharacters,
		},
	);
	const emmetPlugin = wrapPlugin(
		useEmmetPlugin({
			getEmmetConfig: async () => getSettings?.<emmet.VSCodeEmmetConfig>('emmet'),
		}),
		{
			triggerCharacters: emmetTriggerCharacters,
			isAdditionalCompletion: true,
		},
	);
	const scriptTsPlugin = wrapPlugin(
		useTsPlugin({
			getTsLs: () => tsRuntime.context.scriptTsLs,
			baseCompletionOptions: {
				// includeCompletionsForModuleExports: true, // set in server/src/tsConfigs.ts
				includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
			},
		}),
		{
			triggerCharacters: tsTriggerCharacters,
		},
	);
	const _templateTsPlugin = wrapPlugin(
		useTsPlugin({
			getTsLs: () => tsRuntime.context.templateTsLs,
			baseCompletionOptions: {
				// includeCompletionsForModuleExports: true, // set in server/src/tsConfigs.ts
				includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
				quotePreference: 'single',
				includeCompletionsForModuleExports: false,
				includeCompletionsForImportStatements: false,
			},
		}),
		{
			triggerCharacters: tsTriggerCharacters,
		},
	);
	const scriptJsDocPlugin = wrapPlugin(
		useJsDocPlugin({
			getTsLs: () => tsRuntime.context.scriptTsLs,
		}),
		{
			triggerCharacters: jsDocTriggerCharacters,
			isAdditionalCompletion: true,
		},
	);
	const templateJsDocPlugin = wrapPlugin(
		useJsDocPlugin({
			getTsLs: () => tsRuntime.context.templateTsLs,
		}),
		{
			triggerCharacters: jsDocTriggerCharacters,
			isAdditionalCompletion: true,
		},
	);
	const scriptTsDirectiveCommentPlugin = wrapPlugin(
		useDirectiveCommentPlugin({
			getTsLs: () => tsRuntime.context.scriptTsLs,
		}),
		{
			triggerCharacters: directiveCommentTriggerCharacters,
			isAdditionalCompletion: true,
		},
	);
	const templateTsDirectiveCommentPlugin = wrapPlugin(
		useDirectiveCommentPlugin({
			getTsLs: () => tsRuntime.context.templateTsLs,
		}),
		{
			triggerCharacters: directiveCommentTriggerCharacters,
			isAdditionalCompletion: true,
		},
	);
	const templateTsPlugin: LanguageServicePlugin = {
		..._templateTsPlugin,
		async doComplete(textDocument, position, context) {

			const tsComplete = await _templateTsPlugin.doComplete?.(textDocument, position, context);

			if (tsComplete) {
				const sortTexts = completions.getTsCompletions(ts)?.SortText;
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
	};
	const autoDotValuePlugin = wrapPlugin(
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
		htmlPlugin,
		pugPlugin,
		jsonPlugin,
		emmetPlugin,
		scriptTsPlugin,
		scriptJsDocPlugin,
		scriptTsDirectiveCommentPlugin,
		templateTsPlugin,
		templateJsDocPlugin,
		templateTsDirectiveCommentPlugin,
		autoDotValuePlugin,
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
			const plugins = [
				vuePlugin,
				cssPlugin,
				htmlPlugin,
				pugPlugin,
				jsonPlugin,
				emmetPlugin,
			];
			if (lsType === 'template') {
				plugins.push(templateTsPlugin);
				plugins.push(templateJsDocPlugin);
				plugins.push(templateTsDirectiveCommentPlugin);
			}
			else if (lsType === 'script') {
				plugins.push(scriptTsPlugin);
				plugins.push(scriptJsDocPlugin);
				plugins.push(scriptTsDirectiveCommentPlugin);
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
		doValidation: publicApiHook(diagnostics.register(context, () => tsRuntime.update(true)), false, false),
		findDefinition: publicApiHook(findDefinition.on, isTemplateScriptPosition),
		findReferences: publicApiHook(references.register(context), true),
		findTypeDefinition: publicApiHook(findDefinition.onType, isTemplateScriptPosition),
		callHierarchy: {
			doPrepare: publicApiHook(_callHierarchy.doPrepare, isTemplateScriptPosition),
			getIncomingCalls: publicApiHook(_callHierarchy.getIncomingCalls, true),
			getOutgoingCalls: publicApiHook(_callHierarchy.getOutgoingCalls, true),
		},
		prepareRename: publicApiHook(renames.prepareRename, isTemplateScriptPosition),
		doRename: publicApiHook(renames.doRename, true),
		getEditsForFileRename: publicApiHook(renames.onRenameFile, false),
		getSemanticTokens: publicApiHook(semanticTokens.register(context, () => tsRuntime.update(true)), false),

		doHover: publicApiHook(hover.register(context), isTemplateScriptPosition),
		doComplete: publicApiHook(completions.register(context, tsRuntime.getScriptContentVersion), isTemplateScriptPosition),

		getCodeActions: publicApiHook(codeActions.register(context), false),
		doCodeActionResolve: publicApiHook(codeActionResolve.register(context), false),
		doCompletionResolve: publicApiHook(completionResolve.register(context), false),
		doReferencesCodeLensResolve: publicApiHook(codeLensResolve.register(context), false),
		getSignatureHelp: publicApiHook(signatureHelp.register(context), false),
		getReferencesCodeLens: publicApiHook(codeLens.register(context), false),
		findDocumentHighlights: publicApiHook(documentHighlight.register(context), false),
		findDocumentLinks: publicApiHook(documentLink.register(context), false),
		findWorkspaceSymbols: publicApiHook(workspaceSymbol.register(context), false),
		dispose: () => {
			tsRuntime.dispose();
		},
		updateHtmlCustomData: services.updateHtmlCustomData,
		updateCssCustomData: services.updateCssCustomData,

		__internal__: {
			tsRuntime,
			rootPath: vueHost.getCurrentDirectory(),
			context,
			getContext: publicApiHook(() => context, true),
			getD3: publicApiHook(d3.register(context), true),
			detectTagNameCase: publicApiHook(tagNameCase.register(context), true),
		},

		doAutoInsert: publicApiHook(
			(uri: string, position: vscode.Position, options: Parameters<NonNullable<EmbeddedLanguagePlugin['doAutoInsert']>>[2]) => {
				return languageRangeFeatureWorker(
					context,
					uri,
					position,
					sourceMap => true,
					function* (position, sourceMap) {
						for (const [mapedRange] of sourceMap.getMappedRanges(
							position,
							position,
							data => !!data.capabilities.completion,
						)) {
							yield mapedRange.start;
						}
					},
					(plugin, document, position) => plugin.doAutoInsert?.(document, position, options),
					(data, sourceMap) => {

						if (typeof data === 'string')
							return data;

						const range = sourceMap.getSourceRange(data.range.start, data.range.end)?.[0];

						if (range) {
							data.range = range;
							return data;
						}
					},
				);
			},
			false,
		),
	};

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
	function publicApiHook<T extends (...args: any) => any>(
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
