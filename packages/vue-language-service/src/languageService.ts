import * as shared from '@volar/shared';
import * as ts2 from '@volar/typescript-language-service';
import { ConfigurationHost, EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import { createTypeScriptRuntime } from '@volar/vue-typescript';
import { isGloballyWhitelisted } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as upath from 'upath';
import type * as html from 'vscode-html-languageservice';
import * as json from 'vscode-json-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createStylesheetExtra } from './stylesheetExtra';
import useCssPlugin from './commonPlugins/css';
import useDirectiveCommentPlugin from './commonPlugins/directiveComment';
import useEmmetPlugin from './commonPlugins/emmet';
import useHtmlPlugin from './commonPlugins/html';
import useJsDocPlugin from './commonPlugins/jsDoc';
import useJsonPlugin from './commonPlugins/json';
import usePugPlugin from './commonPlugins/pug';
import useTsPlugin from './commonPlugins/typescript';
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
import { getTsSettings } from './tsConfigs';
import { LanguageServiceHost, LanguageServiceRuntimeContext } from './types';
import { parseVueDocuments } from './vueDocuments';
import useAutoDotValuePlugin from './vuePlugins/autoCompleteRefs';
import useHtmlPugConversionsPlugin from './vuePlugins/htmlPugConversions';
import useReferencesCodeLensPlugin from './vuePlugins/referencesCodeLens';
import useRefSugarConversionsPlugin from './vuePlugins/refSugarConversions';
import useScriptSetupConversionsPlugin from './vuePlugins/scriptSetupConversions';
import useTagNameCasingConversionsPlugin from './vuePlugins/tagNameCasingConversions';
import useVuePlugin from './vuePlugins/vue';
import useVueTemplateLanguagePlugin, { semanticTokenTypes as vueTemplateSemanticTokenTypes, triggerCharacters as vueTemplateLanguageTriggerCharacters } from './vuePlugins/vueTemplateLanguage';
// import * as d3 from './ideFeatures/d3';

export interface LanguageService extends ReturnType<typeof createLanguageService> { }

export type LanguageServicePlugin = ReturnType<typeof defineLanguageServicePlugin>;

const directiveCommentTriggerCharacters = ['@'];
const jsDocTriggerCharacters = ['*'];
const cssTriggerCharacters = ['/', '-', ':']; // https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/css-language-features/server/src/cssServer.ts#L97
const htmlTriggerCharacters = ['.', ':', '<', '"', '=', '/']; // https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/html-language-features/server/src/htmlServer.ts#L183
const jsonTriggerCharacters = ['"', ':']; // https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/json-language-features/server/src/jsonServer.ts#L150
const vueTriggerCharacters = htmlTriggerCharacters;

let pluginId = 0;

function defineLanguageServicePlugin<T extends EmbeddedLanguageServicePlugin>(plugin: T, context?: {
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

export function getTriggerCharacters(tsVersion: string) {
	return [...new Set([
		...vueTriggerCharacters,
		...ts2.getTriggerCharacters(tsVersion),
		...jsonTriggerCharacters,
		...jsDocTriggerCharacters,
		...cssTriggerCharacters,
		...htmlTriggerCharacters,
		...directiveCommentTriggerCharacters,
		...vueTemplateLanguageTriggerCharacters,
	])];
}

export function createLanguageService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') },
	vueLsHost: LanguageServiceHost,
	fileSystemProvider: html.FileSystemProvider | undefined,
	schemaRequestService: json.SchemaRequestService | undefined,
	configurationHost: ConfigurationHost | undefined,
	_customPlugins: EmbeddedLanguageServicePlugin[],
	getNameCases?: (uri: string) => Promise<{
		tag: 'both' | 'kebabCase' | 'pascalCase',
		attr: 'kebabCase' | 'camelCase',
	}>,
) {

	const vueCompilerOptions = vueLsHost.getVueCompilationSettings?.() ?? {};
	const tsRuntime = createTypeScriptRuntime({
		typescript: ts,
		vueCompilerOptions,
		getCssClasses: ef => stylesheetExtra.getCssClasses(ef),
		getCssVBindRanges: ef => stylesheetExtra.getCssVBindRanges(ef),
		vueLsHost: vueLsHost,
		isTsPlugin: false,
	});
	const vueDocuments = parseVueDocuments(tsRuntime.vueFiles);
	const tsSettings = getTsSettings(configurationHost);
	const documentContext = getDocumentContext();

	const scriptTsLs = ts2.createLanguageService(ts, tsRuntime.getTsLsHost('script'), tsRuntime.getTsLs('script'), tsSettings);
	const templateTsLsRaw = tsRuntime.getTsLs('template');
	const templateTsLsHost = tsRuntime.getTsLsHost('template');
	const templateTsLs = templateTsLsHost && templateTsLsRaw ? ts2.createLanguageService(ts, templateTsLsHost, templateTsLsRaw, tsSettings) : undefined;
	const blockingRequests = new Set<Promise<any>>();
	const tsTriggerCharacters = ts2.getTriggerCharacters(ts.version);
	const documents = new WeakMap<ts.IScriptSnapshot, TextDocument>();

	// plugins
	const customPlugins = _customPlugins.map(plugin => defineLanguageServicePlugin(plugin));
	const vuePlugin = defineLanguageServicePlugin(
		useVuePlugin({
			configurationHost,
			getVueDocument: (document) => vueDocuments.get(document.uri),
			scriptTsLs,
			documentContext,
		}),
		{
			triggerCharacters: vueTriggerCharacters,
		},
	);
	const vueTemplateHtmlPlugin = _useVueTemplateLanguagePlugin(
		'html',
		useHtmlPlugin({
			configurationHost,
			documentContext,
			fileSystemProvider,
		}),
		htmlTriggerCharacters,
	);
	const vueTemplatePugPlugin = _useVueTemplateLanguagePlugin(
		'jade',
		usePugPlugin({
			configurationHost,
			htmlPlugin: vueTemplateHtmlPlugin,
			documentContext,
		}),
		[],
	);
	const cssPlugin = defineLanguageServicePlugin(
		useCssPlugin({
			configurationHost,
			documentContext,
			fileSystemProvider,
		}),
		{
			triggerCharacters: cssTriggerCharacters,
		},
	);
	const jsonPlugin = defineLanguageServicePlugin(
		useJsonPlugin({
			schema: undefined, // TODO
			schemaRequestService,
		}),
		{
			triggerCharacters: cssTriggerCharacters,
		},
	);
	const emmetPlugin = defineLanguageServicePlugin(
		useEmmetPlugin({
			configurationHost,
		}),
		{
			triggerCharacters: [],
			isAdditionalCompletion: true,
		},
	);
	const scriptTsPlugins = useTsPlugins(
		scriptTsLs,
		false,
		{
			// includeCompletionsForModuleExports: true, // set in server/src/tsConfigs.ts
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
		},
	);
	const templateTsPlugins = templateTsLs ? useTsPlugins(
		templateTsLs,
		true,
		{
			// includeCompletionsForModuleExports: true, // set in server/src/tsConfigs.ts
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
			quotePreference: 'single',
			includeCompletionsForModuleExports: false,
			includeCompletionsForImportStatements: false,
		},
	) : [];
	const autoDotValuePlugin = defineLanguageServicePlugin(
		useAutoDotValuePlugin({
			configurationHost,
			ts,
			getTsLs: () => scriptTsLs,
		}),
	);
	const referencesCodeLensPlugin = defineLanguageServicePlugin(
		useReferencesCodeLensPlugin({
			configurationHost,
			getVueDocument: (uri) => vueDocuments.get(uri),
			findReference: async (...args) => findReferences_internal(...args),
		}),
	);
	const htmlPugConversionsPlugin = defineLanguageServicePlugin(
		useHtmlPugConversionsPlugin({
			configurationHost,
			getVueDocument: (uri) => vueDocuments.get(uri),
		}),
	);
	const scriptSetupConversionsPlugin = defineLanguageServicePlugin(
		useScriptSetupConversionsPlugin({
			configurationHost,
			ts,
			getVueDocument: (uri) => vueDocuments.get(uri),
			doCodeActions: async (...args) => doCodeActions_internal(...args),
			doCodeActionResolve: async (...args) => doCodeActionResolve_internal(...args),
		}),
	);
	const refSugarConversionsPlugin = defineLanguageServicePlugin(
		useRefSugarConversionsPlugin({
			configurationHost,
			ts,
			getVueDocument: (uri) => vueDocuments.get(uri),
			doCodeActions: async (...args) => doCodeActions_internal(...args),
			doCodeActionResolve: async (...args) => doCodeActionResolve_internal(...args),
			findReferences: async (...args) => findReferences_internal(...args),
			doValidation: async (...args) => doValidation_internal(...args),
			doRename: async (...args) => doRename_internal(...args),
			findTypeDefinition: async (...args) => findTypeDefinition_internal(...args),
			scriptTsLs: scriptTsLs,
		}),
	);
	const tagNameCasingConversionsPlugin = defineLanguageServicePlugin(
		useTagNameCasingConversionsPlugin({
			getVueDocument: (uri) => vueDocuments.get(uri),
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

	const stylesheetExtra = createStylesheetExtra(cssPlugin);
	const context: LanguageServiceRuntimeContext = {
		vueDocuments,
		getTsLs: lsType => lsType === 'template' ? templateTsLs! : scriptTsLs,
		getTextDocument,
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

		__internal__: {
			tsRuntime,
			rootPath: vueLsHost.getCurrentDirectory(),
			context,
			getContext: defineApi(() => context, true),
			// getD3: defineApi(d3.register(context), true), // unused for now
			detectTagNameCase: defineApi(tagNameCase.register(context), true),
		},
	};

	function getDocumentContext() {
		const compilerHost = ts.createCompilerHost(vueLsHost.getCompilationSettings());
		const documentContext: html.DocumentContext = {
			resolveReference(ref: string, base: string) {

				const isUri = base.indexOf('://') >= 0;
				const resolveResult = ts.resolveModuleName(
					ref,
					isUri ? shared.uriToFsPath(base) : base,
					vueLsHost.getCompilationSettings(),
					compilerHost,
				);
				const failedLookupLocations: string[] = (resolveResult as any).failedLookupLocations;
				const dirs = new Set<string>();

				const fileExists = vueLsHost.fileExists ?? ts.sys.fileExists;
				const directoryExists = vueLsHost.directoryExists ?? ts.sys.directoryExists;

				for (const failed of failedLookupLocations) {
					let path = failed;
					const fileName = upath.basename(path);
					if (fileName === 'index.d.ts' || fileName === '*.d.ts') {
						dirs.add(upath.dirname(path));
					}
					if (path.endsWith('.d.ts')) {
						path = upath.removeExt(upath.removeExt(path, '.ts'), '.d');
					}
					else {
						continue;
					}
					if (fileExists(path)) {
						return isUri ? shared.fsPathToUri(path) : path;
					}
				}
				for (const dir of dirs) {
					if (directoryExists(dir)) {
						return isUri ? shared.fsPathToUri(dir) : dir;
					}
				}

				return undefined;
			},
		};
		return documentContext;
	}
	function getTextDocument(uri: string) {

		const fileName = shared.uriToFsPath(uri);
		const scriptSnapshot = vueLsHost.getScriptSnapshot(fileName);

		if (scriptSnapshot) {

			let document = documents.get(scriptSnapshot);

			if (!document) {

				document = TextDocument.create(
					uri,
					uri.endsWith('.vue') ? 'vue' : 'typescript', // TODO
					0, // TODO
					scriptSnapshot.getText(0, scriptSnapshot.getLength()),
				);
				documents.set(scriptSnapshot, document);
			}

			return document;
		}
	}
	function _useVueTemplateLanguagePlugin<T extends ReturnType<typeof useHtmlPlugin> | ReturnType<typeof usePugPlugin>>(languageId: string, templateLanguagePlugin: T, triggerCharacters: string[]) {
		return defineLanguageServicePlugin(
			useVueTemplateLanguagePlugin({
				configurationHost,
				ts,
				templateLanguagePlugin,
				getSemanticTokenLegend,
				getScanner: (document): html.Scanner | undefined => {
					if (document.languageId === 'html') {
						return templateLanguagePlugin.htmlLs.createScanner(document.getText());
					}
					else if (document.languageId === 'jade') {
						const pugDocument = 'getPugDocument' in templateLanguagePlugin ? templateLanguagePlugin.getPugDocument(document) : undefined;
						if (pugDocument) {
							return 'pugLs' in templateLanguagePlugin ? templateLanguagePlugin.pugLs.createScanner(pugDocument) : undefined;
						}
					}
				},
				scriptTsLs: scriptTsLs,
				templateTsLs: templateTsLs,
				isSupportedDocument: (document) => document.languageId === languageId,
				getNameCases,
				getScriptContentVersion: tsRuntime.getScriptContentVersion,
				vueLsHost,
				vueDocuments,
				updateTemplateScripts: () => tsRuntime.update(true),
				tsSettings,
				tsRuntime,
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

		const vueDocument = vueDocuments.get(uri);
		if (!vueDocument) {
			return false;
		}

		for (const sourceMap of vueDocument.getSourceMaps()) {
			if (sourceMap.embeddedFile.lsType === 'template') {
				for (const _ of sourceMap.getMappedRanges(pos, pos, data =>
					data.vueTag === 'template'
					|| data.vueTag === 'style' // handle CSS variable injection to fix https://github.com/johnsoncodehk/volar/issues/777
				)) {
					return true;
				}
			}
		}

		const embeddedTemplate = vueDocument.file.getEmbeddedTemplate();
		if (embeddedTemplate) {
			const sourceMap = vueDocument.sourceMapsMap.get(embeddedTemplate);
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
