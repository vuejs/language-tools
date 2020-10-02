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
	DocumentFormattingRequest,
	RenameRequest,
	DocumentFormattingRegistrationOptions,
	CodeActionRequest,
	ReferencesRequest,
	DefinitionRequest,
	TypeDefinitionRequest,
	HoverRequest,
	ExecuteCommandRequest,
	CompletionRequest,
	createConnection,
	DocumentRangeFormattingRequest,
	SelectionRangeRequest,
	SignatureHelpRequest,
	CompletionItem,
} from 'vscode-languageserver';
import { createLanguageServiceHost } from './languageServiceHost';
import { Commands } from '@volar/vscode-vue-languageservice';
import { TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

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

function onInitialize(params: InitializeParams) {
	if (params.rootPath) {
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

	const host = createLanguageServiceHost(connection, documents, rootPath, false);
	let resolveCache: CompletionItem | undefined;

	connection.onCompletion(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return host(document.uri)?.doComplete(document, handler.position, handler.context);
	});
	connection.onCompletionResolve(async item => {
		if (resolveCache && resolveCache.label === item.label && resolveCache.kind === item.kind) {
			return resolveCache;
		}
		const uri = item.data?.uri;
		resolveCache = host(uri)?.doCompletionResolve(item) ?? item;
		return resolveCache;
	});
	connection.onDefinition(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.findDefinition(document, handler.position);
	});
	connection.onTypeDefinition(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.findTypeDefinition(document, handler.position);
	});
	connection.onHover(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.doHover(document, handler.position);
	});
	connection.onColorPresentation(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.getColorPresentations(document, handler.color, handler.range);
	});
	connection.onSignatureHelp(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.getSignatureHelp(document, handler.position);
	});
	connection.onDocumentFormatting(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.doFormatting(document, handler.options);
	});
	connection.onDocumentRangeFormatting(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.doRangeFormatting(document, handler.range, handler.options);
	});
	connection.onSelectionRanges(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.getSelectionRanges(document, handler.positions);
	});
	connection.onCodeAction(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.doCodeAction(document, handler.range);
	});
	connection.onExecuteCommand(handler => {
		const uri = handler.arguments?.[0];
		const document = documents.get(uri);
		if (!document) return undefined;
		return host(uri)?.doExecuteCommand(document, handler.command, connection);
	});
	connection.onRenameRequest(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.doRename(document, handler.position, handler.newName);
	});
	// vue & ts
	connection.onReferences(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host(document.uri)?.findReferences(document, handler.position);
	});
}
function onInitialized() {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}

	const vueOnly: DocumentFormattingRegistrationOptions = {
		documentSelector: [{ language: 'vue' }],
	};
	const both: DocumentFormattingRegistrationOptions = {
		documentSelector: [{ language: 'vue' }, { language: 'typescript' }],
	};

	connection.client.register(ReferencesRequest.type, both);
	connection.client.register(DocumentFormattingRequest.type, vueOnly);
	connection.client.register(DocumentRangeFormattingRequest.type, vueOnly);
	connection.client.register(RenameRequest.type, vueOnly);
	connection.client.register(CodeActionRequest.type, vueOnly);
	connection.client.register(DefinitionRequest.type, vueOnly);
	connection.client.register(TypeDefinitionRequest.type, vueOnly);
	connection.client.register(HoverRequest.type, vueOnly);
	connection.client.register(SelectionRangeRequest.type, vueOnly);
	connection.client.register(SignatureHelpRequest.type, {
		documentSelector: vueOnly.documentSelector,
		triggerCharacters: ['(', ',', '<'],
		retriggerCharacters: [')'],
	});
	connection.client.register(ExecuteCommandRequest.type, {
		commands: [Commands.HTML_TO_PUG_COMMAND, Commands.PUG_TO_HTML_COMMAND]
	});
	connection.client.register(CompletionRequest.type, {
		documentSelector: vueOnly.documentSelector,
		triggerCharacters: [
			'.', '"', '\'', '`', '/', '@', '<', '#', // ts
			'$', // vue
		],
		resolveProvider: true,
	});
}
