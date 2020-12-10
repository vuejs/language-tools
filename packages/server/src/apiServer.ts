/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	TextDocumentSyncKind,
	InitializeResult,
	RenameRequest,
	TextDocumentRegistrationOptions,
	ReferencesRequest,
	DefinitionRequest,
	TypeDefinitionRequest,
	HoverRequest,
	ExecuteCommandRequest,
	CompletionRequest,
	createConnection,
	SelectionRangeRequest,
	SignatureHelpRequest,
	WorkspaceEdit,
	CodeLensRequest,
	CallHierarchyPrepareRequest,
	Disposable,
	SemanticTokensRegistrationType,
} from 'vscode-languageserver/node';
import { createLanguageServiceHost } from './languageServiceHost';
import { Commands, triggerCharacter, SourceMap, TsSourceMap, setScriptSetupRfc, getSemanticTokensLegend } from '@volar/vscode-vue-languageservice';
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	D3Request,
	TagCloseRequest,
	TagEditRequest,
	FormatAllScriptsRequest,
	GetFormattingSourceMapsRequest,
	uriToFsPath,
	RestartServerNotification,
	LinkedEditingRangeRequest,
} from '@volar/shared';
import * as upath from 'upath';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
export const connection = createConnection(ProposedFeatures.all);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize(onInitialize);
connection.onInitialized(onInitialized);

// Make the text document manager listen on the connection
// for open, change and close text document events
const documents = new TextDocuments(TextDocument);
documents.listen(connection);

// Listen on the connection
connection.listen();

const vueOnly: TextDocumentRegistrationOptions = {
	documentSelector: [{ language: 'vue' }],
};
const both: TextDocumentRegistrationOptions = {
	documentSelector: [
		{ language: 'vue' },
		{ language: 'typescript' },
		{ language: 'typescriptreact' },
	],
};
let semanticTokensRequest: Disposable | undefined;

function onInitialize(params: InitializeParams) {
	if (params.rootPath) {
		setScriptSetupRfc(params.initializationOptions.scriptSetupRfc);
		initLanguageService(params.rootPath);
	}

	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}

	return result;
}
function initLanguageService(rootPath: string) {

	const host = createLanguageServiceHost(connection, documents, rootPath, false, async () => {
		if (semanticTokensRequest) {
			semanticTokensRequest.dispose();
			semanticTokensRequest = await connection.client.register(SemanticTokensRegistrationType.type, {
				documentSelector: vueOnly.documentSelector,
				legend: getSemanticTokensLegend(),
				range: true,
				full: true,
			});
		}
	});

	// custom requests
	connection.onNotification(RestartServerNotification.type, async () => {
		host.restart();
	});
	connection.onRequest(D3Request.type, handler => {
		const document = documents.get(handler.uri);
		if (!document) return;
		return host.best(document.uri)?.getD3(document);
	});
	connection.onRequest(TagCloseRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return host.best(document.uri)?.doAutoClose(document, handler.position);
	});
	connection.onRequest(LinkedEditingRangeRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return host.best(document.uri)?.findLinkedEditingRanges(document, handler.position);
	});
	connection.onRequest(TagEditRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return host.best(document.uri)?.doAutoEditTag(document, handler.range);
	});
	connection.onRequest(GetFormattingSourceMapsRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		const sourceFile = host.best(document.uri)?.getSourceFile(document.uri);
		if (!sourceFile) return;
		const result = {
			templates: [...sourceFile.getHtmlSourceMaps().map(s => translateSourceMap(s, 'template')), ...sourceFile.getPugSourceMaps().map(s => translateSourceMap(s, 'template'))],
			styles: sourceFile.getCssSourceMaps().map(s => translateSourceMap(s, 'style')),
			scripts: sourceFile.getTsSourceMaps().map(translateTsSourceMap).filter(script => script.mappings.length > 0),
		};
		return result;

		function translateSourceMap(sourceMap: SourceMap, vueRegion: string) {
			return {
				languageId: sourceMap.targetDocument.languageId,
				content: sourceMap.targetDocument.getText(),
				mappings: [...sourceMap.values()],
				vueRegion,
			};
		}
		function translateTsSourceMap(sourceMap: TsSourceMap) {
			return {
				languageId: sourceMap.targetDocument.languageId,
				content: sourceMap.targetDocument.getText(),
				mappings: [...sourceMap.values()].filter(maped => maped.data.capabilities.formatting),
				vueRegion: sourceMap.isInterpolation ? 'template' : 'script',
			};
		}
	});
	connection.onRequest(FormatAllScriptsRequest.type, async options => {
		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Format', 0, '', true);
		for (const [uri, service] of host.services) {
			const sourceFiles = service.languageService.getAllSourceFiles();
			let i = 0;
			for (const sourceFile of sourceFiles) {
				if (progress.token.isCancellationRequested) {
					continue;
				}
				const doc = sourceFile.getTextDocument();
				const edits = service.languageService.doFormatting(doc, options) ?? [];
				const workspaceEdit: WorkspaceEdit = { changes: { [doc.uri]: edits } };
				await connection.workspace.applyEdit(workspaceEdit);
				progress.report(i++ / sourceFiles.length * 100, upath.relative(service.languageService.rootPath, uriToFsPath(doc.uri)));
			}
		}
		progress.done();
	});

	connection.onCompletion(async handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;

		return host.best(document.uri)?.doComplete(
			document,
			handler.position,
			handler.context,
			async syntax => await getEmmetConfiguration(syntax),
		);

		async function getEmmetConfiguration(syntax: string) {
			const emmetConfig = await connection.workspace.getConfiguration('emmet');
			const syntaxProfiles = Object.assign({}, emmetConfig['syntaxProfiles'] || {});
			const preferences = Object.assign({}, emmetConfig['preferences'] || {});
			// jsx, xml and xsl syntaxes need to have self closing tags unless otherwise configured by user
			if (syntax === 'jsx' || syntax === 'xml' || syntax === 'xsl') {
				syntaxProfiles[syntax] = syntaxProfiles[syntax] || {};
				if (typeof syntaxProfiles[syntax] === 'object'
					&& !syntaxProfiles[syntax].hasOwnProperty('self_closing_tag') // Old Emmet format
					&& !syntaxProfiles[syntax].hasOwnProperty('selfClosingStyle') // Emmet 2.0 format
				) {
					syntaxProfiles[syntax] = {
						...syntaxProfiles[syntax],
						selfClosingStyle: 'xml'
					};
				}
			}

			return {
				preferences,
				showExpandedAbbreviation: emmetConfig['showExpandedAbbreviation'],
				showAbbreviationSuggestions: emmetConfig['showAbbreviationSuggestions'],
				syntaxProfiles,
				variables: emmetConfig['variables'],
				excludeLanguages: emmetConfig['excludeLanguages'],
				showSuggestionsAsSnippets: emmetConfig['showSuggestionsAsSnippets']
			};
		}
	});
	connection.onCompletionResolve(async item => {
		const uri = item.data?.uri;
		return host.best(uri)?.doCompletionResolve(item) ?? item;
	});
	connection.onHover(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.doHover(document, handler.position);
	});
	connection.onSignatureHelp(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.getSignatureHelp(document, handler.position);
	});
	connection.onDocumentFormatting(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.doFormatting(document, handler.options);
	});
	connection.onDocumentRangeFormatting(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.doRangeFormatting(document, handler.range, handler.options);
	});
	connection.onSelectionRanges(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.getSelectionRanges(document, handler.positions);
	});
	connection.onRenameRequest(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.doRename(document, handler.position, handler.newName);
	});
	connection.onCodeLens(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.getCodeLens(document);
	});
	connection.onCodeLensResolve(codeLens => {
		const uri = codeLens.data?.uri;
		return host.best(uri)?.doCodeLensResolve(codeLens) ?? codeLens;
	});
	connection.onExecuteCommand(handler => {
		const uri = handler.arguments?.[0];
		const document = documents.get(uri);
		if (!document) return undefined;
		return host.best(uri)?.doExecuteCommand(document, handler.command, handler.arguments, connection);
	});
	// vue & ts
	connection.onReferences(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.all(document.uri).map(ls => ls.findReferences(document, handler.position, true)).flat();
	});
	connection.onDefinition(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.findDefinition(document, handler.position, true);
	});
	connection.onTypeDefinition(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.findTypeDefinition(document, handler.position, true);
	});
	connection.languages.callHierarchy.onPrepare(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return [];
		const items = host.best(document.uri)?.prepareCallHierarchy(document, handler.position);
		return items?.length ? items : null;
	});
	connection.languages.callHierarchy.onIncomingCalls(handler => {
		const { uri } = handler.item.data as { uri: string };
		return host.best(uri)?.provideCallHierarchyIncomingCalls(handler.item) ?? [];
	});
	connection.languages.callHierarchy.onOutgoingCalls(handler => {
		const { uri } = handler.item.data as { uri: string };
		return host.best(uri)?.provideCallHierarchyOutgoingCalls(handler.item) ?? [];
	});
	connection.languages.semanticTokens.on(async handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return { data: [] };
		const tokens = await host.best(document.uri)?.getSemanticTokens(document);
		if (!tokens) return { data: [] };
		return tokens;
	});
	connection.languages.semanticTokens.onRange(async handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return { data: [] };
		const tokens = await host.best(document.uri)?.getSemanticTokens(document, handler.range);
		if (!tokens) return { data: [] };
		return tokens;
	});
}
async function onInitialized() {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}

	connection.client.register(ReferencesRequest.type, both);
	connection.client.register(DefinitionRequest.type, both);
	connection.client.register(CallHierarchyPrepareRequest.type, both);
	connection.client.register(TypeDefinitionRequest.type, both);
	connection.client.register(HoverRequest.type, vueOnly);
	connection.client.register(RenameRequest.type, vueOnly);
	connection.client.register(SelectionRangeRequest.type, vueOnly);
	connection.client.register(CodeLensRequest.type, {
		documentSelector: vueOnly.documentSelector,
		resolveProvider: true,
	});
	connection.client.register(SignatureHelpRequest.type, {
		documentSelector: vueOnly.documentSelector,
		triggerCharacters: ['(', ',', '<'],
		retriggerCharacters: [')'],
	});
	connection.client.register(ExecuteCommandRequest.type, {
		commands: [
			Commands.HTML_TO_PUG,
			Commands.PUG_TO_HTML,
			Commands.SWITCH_REF_SUGAR,
			Commands.SHOW_REFERENCES,
		]
	});
	connection.client.register(CompletionRequest.type, {
		documentSelector: vueOnly.documentSelector,
		triggerCharacters: [...triggerCharacter.typescript, ...triggerCharacter.html],
		resolveProvider: true,
	});
	semanticTokensRequest = await connection.client.register(SemanticTokensRegistrationType.type, {
		documentSelector: vueOnly.documentSelector,
		legend: getSemanticTokensLegend(),
		range: true,
		full: true,
	});
}
