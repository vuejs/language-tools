import useCssPlugin from '@volar-plugins/css';
import useEmmetPlugin from '@volar-plugins/emmet';
import useHtmlPlugin from '@volar-plugins/html';
import useJsonPlugin from '@volar-plugins/json';
import usePugPlugin from '@volar-plugins/pug';
import useTsPlugin from '@volar-plugins/typescript';
import * as embedded from '@volar/embedded-language-service';
import * as shared from '@volar/shared';
import * as tsFaster from '@volar/typescript-faster';
import * as ts2 from '@volar/typescript-language-service';
import * as vue from '@volar/vue-language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as upath from 'upath';
import type * as html from 'vscode-html-languageservice';
import * as json from 'vscode-json-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import * as tagNameCase from './ideFeatures/tagNameCase';
import useVuePlugin from './plugins/vue';
import useAutoDotValuePlugin from './plugins/vue-autoinsert-dotvalue';
import useReferencesCodeLensPlugin from './plugins/vue-codelens-references';
import useHtmlPugConversionsPlugin from './plugins/vue-convert-htmlpug';
import useRefSugarConversionsPlugin from './plugins/vue-convert-refsugar';
import useScriptSetupConversionsPlugin from './plugins/vue-convert-scriptsetup';
import useTagNameCasingConversionsPlugin from './plugins/vue-convert-tagcasing';
import useVueTemplateLanguagePlugin, { semanticTokenTypes as vueTemplateSemanticTokenTypes } from './plugins/vue-template';

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
	host: vue.VueLanguageServiceHost,
	fileSystemProvider: html.FileSystemProvider | undefined,
	schemaRequestService: json.SchemaRequestService | undefined,
	configurationHost: embedded.ConfigurationHost | undefined,
	customPlugins: embedded.EmbeddedLanguageServicePlugin[],
	getNameCases?: (uri: string) => Promise<{
		tag: 'both' | 'kebabCase' | 'pascalCase',
		attr: 'kebabCase' | 'camelCase',
	}>,
	createLanguageServiceContext = () => vue.createVueLanguageContext(host),
	rootUri = URI.file(host.getCurrentDirectory()),
) {

	const ts = host.getTypeScriptModule();
	const core = createLanguageServiceContext();
	const tsLs = ts.createLanguageService(core.typescriptLanguageServiceHost);
	tsFaster.decorate(ts, core.typescriptLanguageServiceHost, tsLs);

	embedded.setContextStore({
		rootUri: rootUri.toString(),
		typescript: {
			module: ts,
			languageServiceHost: core.typescriptLanguageServiceHost,
			languageService: tsLs,
		},
		configurationHost,
		documentContext: getDocumentContext(),
		fileSystemProvider,
		schemaRequestService,
	});

	const vueDocuments = embedded.parseSourceFileDocuments(rootUri, core.mapper);
	const documents = new WeakMap<ts.IScriptSnapshot, TextDocument>();
	const documentVersions = new Map<string, number>();

	const context: embedded.LanguageServiceRuntimeContext = {
		host,
		core,
		typescriptLanguageService: tsLs,
		documents: vueDocuments,
		getTextDocument,
		get plugins() {
			return allPlugins;
		},
	};
	const apis = embedded.createLanguageService(context);

	// plugins
	const scriptTsPlugin = useTsPlugin();
	const vuePlugin = useVuePlugin({
		getVueDocument: (document) => vueDocuments.get(document.uri),
		tsLs: scriptTsPlugin.languageService,
		isJsxMissing: !host.getVueCompilationSettings().experimentalDisableTemplateSupport && host.getCompilationSettings().jsx !== ts.JsxEmit.Preserve,
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
		getTsLs: () => scriptTsPlugin.languageService,
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
		scriptTsLs: scriptTsPlugin.languageService,
	});
	const tagNameCasingConversionsPlugin = useTagNameCasingConversionsPlugin({
		getVueDocument: (uri) => vueDocuments.get(uri),
		findReferences: apis.findReferences,
		getTsLs: () => scriptTsPlugin.languageService,
	});

	const allPlugins = [
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
	];

	return {
		...apis,
		dispose: () => {
			tsLs.dispose();
		},
		__internal__: {
			vueRuntimeContext: core,
			rootPath: host.getCurrentDirectory(),
			context,
			detectTagNameCase: tagNameCase.register(context),
		},
	};

	function getDocumentContext() {
		const documentContext: html.DocumentContext = {
			resolveReference(ref: string, base: string) {

				const isUri = base.indexOf('://') >= 0;
				const resolveResult = ts.resolveModuleName(
					ref,
					isUri ? shared.getPathOfUri(base) : base,
					context.host.getCompilationSettings(),
					context.host,
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
					if (host.fileExists(path)) {
						return isUri ? shared.getUriByPath(URI.parse(base), path) : path;
					}
				}
				for (const dir of dirs) {
					if (host.directoryExists?.(dir) ?? true) {
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
		const scriptSnapshot = host.getScriptSnapshot(fileName);

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
			tsLs: scriptTsPlugin.languageService,
			isSupportedDocument: (document) =>
				document.languageId === languageId
				&& !vueDocuments.get(document.uri) /* not petite-vue source file */,
			getNameCases,
			vueLsHost: host,
			vueDocuments,
		});
	}
}
