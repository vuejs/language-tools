import * as shared from '@volar/shared';
import * as tsFaster from '@volar/typescript-faster';
import * as ts2 from '@volar/typescript-language-service';
import { ConfigurationHost, EmbeddedLanguageServicePlugin, setCurrentConfigurationHost } from '@volar/vue-language-service-types';
import * as vueTs from '@volar/vue-typescript';
import { isGloballyWhitelisted } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as upath from 'upath';
import type * as html from 'vscode-html-languageservice';
import * as json from 'vscode-json-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as tagNameCase from './ideFeatures/tagNameCase';
import * as autoInsert from './languageFeatures/autoInsert';
import * as callHierarchy from './languageFeatures/callHierarchy';
import * as codeActionResolve from './languageFeatures/codeActionResolve';
import * as codeActions from './languageFeatures/codeActions';
import * as codeLens from './languageFeatures/codeLens';
import * as codeLensResolve from './languageFeatures/codeLensResolve';
import * as completions from './languageFeatures/complete';
import * as completionResolve from './languageFeatures/completeResolve';
import * as definition from './languageFeatures/definition';
import * as documentHighlight from './languageFeatures/documentHighlights';
import * as documentLink from './languageFeatures/documentLinks';
import * as semanticTokens from './languageFeatures/documentSemanticTokens';
import * as executeCommand from './languageFeatures/executeCommand';
import * as fileReferences from './languageFeatures/fileReferences';
import * as fileRename from './languageFeatures/fileRename';
import * as hover from './languageFeatures/hover';
import * as inlayHints from './languageFeatures/inlayHints';
import * as references from './languageFeatures/references';
import * as rename from './languageFeatures/rename';
import * as renamePrepare from './languageFeatures/renamePrepare';
import * as signatureHelp from './languageFeatures/signatureHelp';
import * as diagnostics from './languageFeatures/validation';
import * as workspaceSymbol from './languageFeatures/workspaceSymbols';
import useCssPlugin from './plugins/css';
import useEmmetPlugin from './plugins/emmet';
import useHtmlPlugin from './plugins/html';
import useJsonPlugin from './plugins/json';
import usePugPlugin from './plugins/pug';
import useTsPlugin from './plugins/typescript';
import useVuePlugin from './plugins/vue';
import useAutoDotValuePlugin from './plugins/vue-autoinsert-dotvalue';
import useReferencesCodeLensPlugin from './plugins/vue-codelens-references';
import useHtmlPugConversionsPlugin from './plugins/vue-convert-htmlpug';
import useRefSugarConversionsPlugin from './plugins/vue-convert-refsugar';
import useScriptSetupConversionsPlugin from './plugins/vue-convert-scriptsetup';
import useTagNameCasingConversionsPlugin from './plugins/vue-convert-tagcasing';
import useVueTemplateLanguagePlugin, { semanticTokenTypes as vueTemplateSemanticTokenTypes } from './plugins/vue-template';
import { getTsSettings } from './tsConfigs';
import { LanguageServiceRuntimeContext } from './types';
import { parseVueDocuments } from './vueDocuments';
// import * as d3 from './ideFeatures/d3';

export interface LanguageService extends ReturnType<typeof createLanguageService> { }

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

export function createLanguageService(
	{ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary'); },
	vueLsHost: vueTs.LanguageServiceHost,
	fileSystemProvider: html.FileSystemProvider | undefined,
	schemaRequestService: json.SchemaRequestService | undefined,
	configurationHost: ConfigurationHost | undefined,
	customPlugins: EmbeddedLanguageServicePlugin[],
	getNameCases?: (uri: string) => Promise<{
		tag: 'both' | 'kebabCase' | 'pascalCase',
		attr: 'kebabCase' | 'camelCase',
	}>,
	createLanguageServiceContext = () => vueTs.createLanguageServiceContext(ts, vueLsHost),
) {

	setCurrentConfigurationHost(configurationHost); // TODO

	const vueLsCtx = createLanguageServiceContext();
	tsFaster.decorate(ts, vueLsCtx.typescriptLanguageServiceHost, vueLsCtx.typescriptLanguageService);
	const tsSettings = getTsSettings(configurationHost);
	const tsLs = ts2.createLanguageService(ts, vueLsCtx.typescriptLanguageServiceHost, vueLsCtx.typescriptLanguageService, tsSettings);
	const vueDocuments = parseVueDocuments(vueLsCtx, tsLs);
	const documentContext = getDocumentContext();

	const blockingRequests = new Set<Promise<any>>();
	const documents = new WeakMap<ts.IScriptSnapshot, TextDocument>();
	const documentVersions = new Map<string, number>();

	// plugins
	const vuePlugin = useVuePlugin({
		getVueDocument: (document) => vueDocuments.get(document.uri),
		tsLs,
	});
	const vueTemplateHtmlPlugin = _useVueTemplateLanguagePlugin(
		'html',
		useHtmlPlugin({
			documentContext,
			fileSystemProvider,
		}),
	);
	const vueTemplatePugPlugin = _useVueTemplateLanguagePlugin(
		'jade',
		usePugPlugin({
			configurationHost,
			htmlPlugin: vueTemplateHtmlPlugin,
			documentContext,
		}),
	);
	const cssPlugin = useCssPlugin({
		documentContext,
		fileSystemProvider,
	});
	const jsonPlugin = useJsonPlugin({
		schema: undefined, // TODO
		schemaRequestService,
	});
	const emmetPlugin = useEmmetPlugin();
	const scriptTsPlugin = useTsPlugins(
		tsLs,
		false,
		uri => (uri.indexOf('.__VLS_template') === -1 ? {
			// includeCompletionsForModuleExports: true, // set in server/src/tsConfigs.ts
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
		} : {
			// includeCompletionsForModuleExports: true, // set in server/src/tsConfigs.ts
			includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
			quotePreference: 'single',
			includeCompletionsForModuleExports: false,
			includeCompletionsForImportStatements: false,
		}),
	);
	const autoDotValuePlugin = useAutoDotValuePlugin({
		ts,
		getTsLs: () => tsLs,
	});
	const referencesCodeLensPlugin = useReferencesCodeLensPlugin({
		getVueDocument: (uri) => vueDocuments.get(uri),
		findReference: async (...args) => findReferences_internal(...args),
	});
	const htmlPugConversionsPlugin = useHtmlPugConversionsPlugin({
		getVueDocument: (uri) => vueDocuments.get(uri),
	});
	const scriptSetupConversionsPlugin = useScriptSetupConversionsPlugin({
		ts,
		getVueDocument: (uri) => vueDocuments.get(uri),
		doCodeActions: async (...args) => doCodeActions_internal(...args),
		doCodeActionResolve: async (...args) => doCodeActionResolve_internal(...args),
	});
	const refSugarConversionsPlugin = useRefSugarConversionsPlugin({
		ts,
		getVueDocument: (uri) => vueDocuments.get(uri),
		doCodeActions: async (...args) => doCodeActions_internal(...args),
		doCodeActionResolve: async (...args) => doCodeActionResolve_internal(...args),
		findReferences: async (...args) => findReferences_internal(...args),
		doValidation: async (...args) => doValidation_internal(...args),
		doRename: async (...args) => doRename_internal(...args),
		findTypeDefinition: async (...args) => findTypeDefinition_internal(...args),
		scriptTsLs: tsLs,
	});
	const tagNameCasingConversionsPlugin = useTagNameCasingConversionsPlugin({
		getVueDocument: (uri) => vueDocuments.get(uri),
		findReferences: async (...args) => findReferences_internal(...args),
	});

	const allPlugins = [
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
		scriptTsPlugin,
	];

	const context: LanguageServiceRuntimeContext = {
		vueDocuments,
		getTsLs: () => tsLs,
		getTextDocument,
		getPlugins: () => [
			...customPlugins,
			vuePlugin,
			cssPlugin,
			vueTemplateHtmlPlugin,
			vueTemplatePugPlugin,
			jsonPlugin,
			referencesCodeLensPlugin,
			htmlPugConversionsPlugin,
			scriptSetupConversionsPlugin,
			refSugarConversionsPlugin,
			tagNameCasingConversionsPlugin,
			scriptTsPlugin,
			autoDotValuePlugin,
			// put emmet plugin last to fix https://github.com/johnsoncodehk/volar/issues/1088
			emmetPlugin,
		],
		getPluginId: plugin => allPlugins.indexOf(plugin),
		getPluginById: id => allPlugins[id],
	};
	const _callHierarchy = callHierarchy.register(context);
	const findReferences_internal = references.register(context);
	const doCodeActions_internal = codeActions.register(context);
	const doCodeActionResolve_internal = codeActionResolve.register(context);
	const doValidation_internal = diagnostics.register(context);
	const doRename_internal = rename.register(context);
	const findTypeDefinition_internal = definition.register(context, 'findTypeDefinition', data => !!data.capabilities.definitions, data => !!data.capabilities.definitions);

	return {
		doValidation: defineApi(diagnostics.register(context), false),
		findReferences: defineApi(references.register(context)),
		findFileReferences: defineApi(fileReferences.register(context)),
		findDefinition: defineApi(definition.register(context, 'findDefinition', data => !!data.capabilities.definitions, data => !!data.capabilities.definitions)),
		findTypeDefinition: defineApi(definition.register(context, 'findTypeDefinition', data => !!data.capabilities.definitions, data => !!data.capabilities.definitions)),
		findImplementations: defineApi(definition.register(context, 'findImplementations', data => !!data.capabilities.references, data => false)),
		prepareRename: defineApi(renamePrepare.register(context)),
		doRename: defineApi(rename.register(context)),
		getEditsForFileRename: defineApi(fileRename.register(context)),
		getSemanticTokens: defineApi(semanticTokens.register(context)),
		doHover: defineApi(hover.register(context)),
		doComplete: defineApi(completions.register(context)),
		doCodeActions: defineApi(codeActions.register(context)),
		doCodeActionResolve: defineApi(codeActionResolve.register(context)),
		doCompletionResolve: defineApi(completionResolve.register(context)),
		getSignatureHelp: defineApi(signatureHelp.register(context)),
		doCodeLens: defineApi(codeLens.register(context)),
		doCodeLensResolve: defineApi(codeLensResolve.register(context)),
		findDocumentHighlights: defineApi(documentHighlight.register(context)),
		findDocumentLinks: defineApi(documentLink.register(context)),
		findWorkspaceSymbols: defineApi(workspaceSymbol.register(context)),
		doAutoInsert: defineApi(autoInsert.register(context)),
		doExecuteCommand: defineApi(executeCommand.register(context)),
		getInlayHints: defineApi(inlayHints.register(context)),
		callHierarchy: {
			doPrepare: defineApi(_callHierarchy.doPrepare),
			getIncomingCalls: defineApi(_callHierarchy.getIncomingCalls),
			getOutgoingCalls: defineApi(_callHierarchy.getOutgoingCalls),
		},
		dispose: () => {
			vueLsCtx.typescriptLanguageService.dispose();
		},

		__internal__: {
			vueRuntimeContext: vueLsCtx,
			rootPath: vueLsHost.getCurrentDirectory(),
			context,
			getContext: defineApi(() => context),
			// getD3: defineApi(d3.register(context), true), // unused for now
			detectTagNameCase: defineApi(tagNameCase.register(context)),
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
						path = path.substring(0, path.length - '.d.ts'.length);
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
		const scriptSnapshot = vueLsHost.getScriptFileNames().includes(fileName) ? vueLsHost.getScriptSnapshot(fileName) : undefined;

		if (scriptSnapshot) {

			let document = documents.get(scriptSnapshot);

			if (!document) {

				const newVersion = (documentVersions.get(uri.toLowerCase()) ?? 0) + 1;

				documentVersions.set(uri.toLowerCase(), newVersion);

				document = TextDocument.create(
					uri,
					shared.syntaxToLanguageId(upath.extname(uri).slice(1)),
					newVersion,
					scriptSnapshot.getText(0, scriptSnapshot.getLength()),
				);
				documents.set(scriptSnapshot, document);
			}

			return document;
		}
	}
	function _useVueTemplateLanguagePlugin<T extends ReturnType<typeof useHtmlPlugin> | ReturnType<typeof usePugPlugin>>(languageId: string, templateLanguagePlugin: T) {
		return useVueTemplateLanguagePlugin({
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
			tsLs,
			isSupportedDocument: (document) => document.languageId === languageId,
			getNameCases,
			vueLsHost,
			vueDocuments,
			tsSettings,
		});
	}
	function useTsPlugins(tsLs: ts2.LanguageService, isTemplatePlugin: boolean, getBaseCompletionOptions: (uri: string) => ts.GetCompletionsAtPositionOptions) {
		const _languageSupportPlugin = useTsPlugin({
			tsVersion: ts.version,
			getTsLs: () => tsLs,
			getBaseCompletionOptions,
		});
		const languageSupportPlugin: EmbeddedLanguageServicePlugin = isTemplatePlugin ? {
			..._languageSupportPlugin,
			complete: {
				..._languageSupportPlugin.complete,
				async on(textDocument, position, context) {

					const tsComplete = await _languageSupportPlugin.complete?.on?.(textDocument, position, context);

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
			},
		} : _languageSupportPlugin;
		return languageSupportPlugin;
	}
	function defineApi<T extends (...args: any) => any>(
		api: T,
		blockNewRequest = true,
	): (...args: Parameters<T>) => Promise<ReturnType<T>> {
		const handler = {
			async apply(target: (...args: any) => any, thisArg: any, argumentsList: Parameters<T>) {
				for (const runningRequest of blockingRequests) {
					await runningRequest;
				}
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
