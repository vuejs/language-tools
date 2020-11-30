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
} from 'vscode-languageserver/node';
import { createLanguageServiceHost } from './languageServiceHost';
import { Commands, triggerCharacter, SourceMap, TsSourceMap, setScriptSetupRfc } from '@volar/vscode-vue-languageservice';
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	TagCloseRequest,
	FormatAllScriptsRequest,
	GetFormattingSourceMapsRequest,
	uriToFsPath,
	EmmetConfigurationRequest,
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

	const host = createLanguageServiceHost(connection, documents, rootPath, false, false);

	// custom requests
	connection.onRequest(TagCloseRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return host.best(document.uri)?.doAutoClose(document, handler.position);
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
			syntax => connection.sendRequest(EmmetConfigurationRequest.type, syntax),
		);
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
		return host.all(document.uri).map(ls => ls.findReferences(document, handler.position)).flat();
	});
	connection.onDefinition(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.findDefinition(document, handler.position);
	});
	connection.onTypeDefinition(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.findTypeDefinition(document, handler.position);
	});
	connection.languages.callHierarchy.onPrepare(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return [];
		return host.all(document.uri).map(ls => ls.prepareCallHierarchy(document, handler.position)).flat();
	});
	connection.languages.callHierarchy.onIncomingCalls(handler => {
		const { uri } = handler.item.data as { uri: string };
		return host.all(uri).map(ls => ls.provideCallHierarchyIncomingCalls(handler.item)).flat();
	});
	connection.languages.callHierarchy.onOutgoingCalls(handler => {
		const { uri } = handler.item.data as { uri: string };
		return host.all(uri).map(ls => ls.provideCallHierarchyOutgoingCalls(handler.item)).flat();
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
}
