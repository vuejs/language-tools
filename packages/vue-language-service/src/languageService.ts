import * as shared from '@volar/shared';
import * as tsFaster from '@volar/typescript-faster';
import * as ts2 from '@volar/typescript-language-service';
import { ConfigurationHost, EmbeddedLanguageServicePlugin, setContextStore } from '@volar/common-language-service';
import * as vue from '@volar/vue-language-core';
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
import useCssPlugin from '@volar-plugins/css';
import useEmmetPlugin from '@volar-plugins/emmet';
import useHtmlPlugin from '@volar-plugins/html';
import useJsonPlugin from '@volar-plugins/json';
import usePugPlugin from '@volar-plugins/pug';
import useTsPlugin from '@volar-plugins/typescript';
import useVuePlugin from './plugins/vue';
import useAutoDotValuePlugin from './plugins/vue-autoinsert-dotvalue';
import useReferencesCodeLensPlugin from './plugins/vue-codelens-references';
import useHtmlPugConversionsPlugin from './plugins/vue-convert-htmlpug';
import useRefSugarConversionsPlugin from './plugins/vue-convert-refsugar';
import useScriptSetupConversionsPlugin from './plugins/vue-convert-scriptsetup';
import useTagNameCasingConversionsPlugin from './plugins/vue-convert-tagcasing';
import useVueTemplateLanguagePlugin, { semanticTokenTypes as vueTemplateSemanticTokenTypes } from './plugins/vue-template';
import { LanguageServiceRuntimeContext } from './types';
import { parseVueDocuments } from './vueDocuments';
import { URI } from 'vscode-uri';
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
	vueLsHost: vue.LanguageServiceHost,
	fileSystemProvider: html.FileSystemProvider | undefined,
	schemaRequestService: json.SchemaRequestService | undefined,
	configurationHost: ConfigurationHost | undefined,
	customPlugins: EmbeddedLanguageServicePlugin[],
	getNameCases?: (uri: string) => Promise<{
		tag: 'both' | 'kebabCase' | 'pascalCase',
		attr: 'kebabCase' | 'camelCase',
	}>,
	createLanguageServiceContext = () => vue.createLanguageContext(vueLsHost),
	rootUri = URI.file(vueLsHost.getCurrentDirectory()),
) {

	const ts = vueLsHost.getTypeScriptModule();
	const core = createLanguageServiceContext();
	const vueTsLs = ts.createLanguageService(core.typescriptLanguageServiceHost);
	tsFaster.decorate(ts, core.typescriptLanguageServiceHost, vueTsLs);

	setContextStore({
		rootUri: rootUri.toString(),
		typescript: {
			module: ts,
			languageServiceHost: core.typescriptLanguageServiceHost,
			languageService: vueTsLs,
		},
		configurationHost,
		documentContext: getDocumentContext(),
		fileSystemProvider,
		schemaRequestService,
	});

	const scriptTsPlugin = useTsPlugin();

	const tsLs = scriptTsPlugin.languageService;
	const vueDocuments = parseVueDocuments(rootUri, core, tsLs);

	const documents = new WeakMap<ts.IScriptSnapshot, TextDocument>();
	const documentVersions = new Map<string, number>();

	const context: LanguageServiceRuntimeContext = {
		host: vueLsHost,
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
	const apis = {
		doValidation: diagnostics.register(context),
		findReferences: references.register(context),
		findFileReferences: fileReferences.register(context),
		findDefinition: definition.register(context, 'findDefinition', data => !!data.capabilities.definitions, data => !!data.capabilities.definitions),
		findTypeDefinition: definition.register(context, 'findTypeDefinition', data => !!data.capabilities.definitions, data => !!data.capabilities.definitions),
		findImplementations: definition.register(context, 'findImplementations', data => !!data.capabilities.references, data => false),
		prepareRename: renamePrepare.register(context),
		doRename: rename.register(context),
		getEditsForFileRename: fileRename.register(context),
		getSemanticTokens: semanticTokens.register(context),
		doHover: hover.register(context),
		doComplete: completions.register(context),
		doCodeActions: codeActions.register(context),
		doCodeActionResolve: codeActionResolve.register(context),
		doCompletionResolve: completionResolve.register(context),
		getSignatureHelp: signatureHelp.register(context),
		doCodeLens: codeLens.register(context),
		doCodeLensResolve: codeLensResolve.register(context),
		findDocumentHighlights: documentHighlight.register(context),
		findDocumentLinks: documentLink.register(context),
		findWorkspaceSymbols: workspaceSymbol.register(context),
		doAutoInsert: autoInsert.register(context),
		doExecuteCommand: executeCommand.register(context),
		getInlayHints: inlayHints.register(context),
		callHierarchy: callHierarchy.register(context),
		dispose: () => {
			vueTsLs.dispose();
		},

		__internal__: {
			vueRuntimeContext: core,
			rootPath: vueLsHost.getCurrentDirectory(),
			context,
			getContext: () => context,
			// getD3: d3.register(context), true), // unused for nw
			detectTagNameCase: tagNameCase.register(context),
		},
	};
	// plugins
	const vuePlugin = useVuePlugin({
		getVueDocument: (document) => vueDocuments.get(document.uri),
		tsLs,
		isJsxMissing: !vueLsHost.getVueCompilationSettings().experimentalDisableTemplateSupport && vueLsHost.getCompilationSettings().jsx !== ts.JsxEmit.Preserve,
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
	const autoDotValuePlugin = useAutoDotValuePlugin({
		getTsLs: () => tsLs,
	});
	const referencesCodeLensPlugin = useReferencesCodeLensPlugin({
		getVueDocument: (uri) => vueDocuments.get(uri),
		findReference: apis.findReferences,
	});
	const htmlPugConversionsPlugin = useHtmlPugConversionsPlugin({
		getVueDocument: (uri) => vueDocuments.get(uri),
	});
	const scriptSetupConversionsPlugin = useScriptSetupConversionsPlugin({
		getVueDocument: (uri) => vueDocuments.get(uri),
		doCodeActions: apis.doCodeActions,
		doCodeActionResolve: apis.doCodeActionResolve,
	});
	const refSugarConversionsPlugin = useRefSugarConversionsPlugin({
		getVueDocument: (uri) => vueDocuments.get(uri),
		doCodeActions: apis.doCodeActions,
		doCodeActionResolve: apis.doCodeActionResolve,
		findReferences: apis.findReferences,
		doValidation: apis.doValidation,
		doRename: apis.doRename,
		findTypeDefinition: apis.findTypeDefinition,
		scriptTsLs: tsLs,
	});
	const tagNameCasingConversionsPlugin = useTagNameCasingConversionsPlugin({
		getVueDocument: (uri) => vueDocuments.get(uri),
		findReferences: apis.findReferences,
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

	return apis;

	function getDocumentContext() {
		const documentContext: html.DocumentContext = {
			resolveReference(ref: string, base: string) {

				const isUri = base.indexOf('://') >= 0;
				const resolveResult = ts.resolveModuleName(
					ref,
					isUri ? shared.getPathOfUri(base) : base,
					vueLsHost.getCompilationSettings(),
					vueLsHost,
				);
				const failedLookupLocations: string[] = (resolveResult as any).failedLookupLocations;
				const dirs = new Set<string>();

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
					if (vueLsHost.fileExists(path)) {
						return isUri ? shared.getUriByPath(URI.parse(base), path) : path;
					}
				}
				for (const dir of dirs) {
					if (vueLsHost.directoryExists?.(dir) ?? true) {
						return isUri ? shared.getUriByPath(URI.parse(base), dir) : dir;
					}
				}

				return undefined;
			},
		};
		return documentContext;
	}
	function getTextDocument(uri: string) {

		const fileName = shared.getPathOfUri(uri);
		const scriptSnapshot = vueLsHost.getScriptSnapshot(fileName);

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
			rootUri,
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
			isSupportedDocument: (document) =>
				document.languageId === languageId
				&& !vueDocuments.get(document.uri) /* not petite-vue source file */,
			getNameCases,
			vueLsHost,
			vueDocuments,
		});
	}
}
