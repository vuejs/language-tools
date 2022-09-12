import { createEmbeddedLanguageServiceHost, LanguageServiceHost } from '@volar/language-core';
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
import { EmbeddedLanguageServicePlugin } from './plugin';
import { LanguageServiceRuntimeContext as LanguageServiceContext, PluginContext } from './types';
import * as tsFaster from '@volar/typescript-faster';
import * as shared from '@volar/shared';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseSourceFileDocuments } from './documents';

// fix build
import type * as _0 from 'vscode-languageserver-protocol';

export type LanguageService = ReturnType<typeof createLanguageService>;

export function createLanguageServiceContext(options: {
	host: LanguageServiceHost,
	languageContext: ReturnType<typeof createEmbeddedLanguageServiceHost>,
	createPlugins(): EmbeddedLanguageServicePlugin[],
	env: PluginContext['env'];
}) {

	const ts = options.host.getTypeScriptModule();
	const tsLs = ts.createLanguageService(options.languageContext.typescriptLanguageServiceHost);
	tsFaster.decorate(ts, options.languageContext.typescriptLanguageServiceHost, tsLs);

	let plugins: EmbeddedLanguageServicePlugin[];

	const pluginContext: PluginContext = {
		env: options.env,
		typescript: {
			module: options.host.getTypeScriptModule(),
			languageServiceHost: options.languageContext.typescriptLanguageServiceHost,
			languageService: tsLs,
		},
	};
	const textDocumentMapper = parseSourceFileDocuments(options.env.rootUri, options.languageContext.mapper);
	const documents = new WeakMap<ts.IScriptSnapshot, TextDocument>();
	const documentVersions = new Map<string, number>();
	const context: LanguageServiceContext = {
		host: options.host,
		core: options.languageContext,
		get plugins() {
			if (!plugins) {
				plugins = options.createPlugins();
				for (const plugin of plugins) {
					plugin.setup?.(pluginContext);
				}
			}
			return plugins;
		},
		pluginContext,
		typescriptLanguageService: tsLs,
		documents: textDocumentMapper,
		getTextDocument,
	};

	return context;

	function getTextDocument(uri: string) {

		const fileName = shared.getPathOfUri(uri);
		const scriptSnapshot = options.host.getScriptSnapshot(fileName);

		if (scriptSnapshot) {

			let document = documents.get(scriptSnapshot);

			if (!document) {

				const newVersion = (documentVersions.get(uri.toLowerCase()) ?? 0) + 1;

				documentVersions.set(uri.toLowerCase(), newVersion);

				document = TextDocument.create(
					uri,
					shared.syntaxToLanguageId(uri.substring(uri.lastIndexOf('.') + 1)),
					newVersion,
					scriptSnapshot.getText(0, scriptSnapshot.getLength()),
				);
				documents.set(scriptSnapshot, document);
			}

			return document;
		}
	}
}

export function createLanguageService(context: LanguageServiceContext) {

	return {
		doValidation: diagnostics.register(context),
		findReferences: references.register(context),
		findFileReferences: fileReferences.register(context),
		findDefinition: definition.register(context, 'findDefinition', data => !!data.definitions, data => !!data.definitions),
		findTypeDefinition: definition.register(context, 'findTypeDefinition', data => !!data.definitions, data => !!data.definitions),
		findImplementations: definition.register(context, 'findImplementations', data => !!data.references, data => false),
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
		dispose: () => context.typescriptLanguageService.dispose(),
		context,
	};
}
