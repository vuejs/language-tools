/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	InitializeResult,
	createConnection,
	TextDocumentRegistrationOptions,
	DocumentHighlightRequest,
	DocumentSymbolRequest,
	DocumentLinkRequest,
	DocumentColorRequest,
	FoldingRangeRequest,
	TextDocuments,
	Disposable,
	SemanticTokensRegistrationType,
} from 'vscode-languageserver/node';
import { createLanguageServiceHost } from './languageServiceHost';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { setScriptSetupRfc, getSemanticTokensLegend } from '@volar/vscode-vue-languageservice';
import {
	uriToFsPath,
	VerifyAllScriptsRequest,
	WriteVirtualFilesRequest,
	RestartServerNotification,
} from '@volar/shared';
import * as upath from 'upath';
import * as fs from 'fs-extra';

export const connection = createConnection(ProposedFeatures.all);
connection.onInitialize(onInitialize);
connection.onInitialized(onInitialized);
const documents = new TextDocuments(TextDocument);
documents.listen(connection);
connection.listen();

const vueOnly: TextDocumentRegistrationOptions = {
	documentSelector: [{ language: 'vue' }],
};
let semanticTokensRequest: Disposable | undefined;

function onInitialize(params: InitializeParams) {
	if (params.rootPath) {
		setScriptSetupRfc(params.initializationOptions.scriptSetupRfc);
		initLanguageService(params.rootPath);
	}
	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
		}
	};
	return result;
}
function initLanguageService(rootPath: string) {

	const host = createLanguageServiceHost(connection, documents, rootPath, true, async () => {
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

	connection.onNotification(RestartServerNotification.type, async () => {
		host.restart();
	});
	connection.onRequest(WriteVirtualFilesRequest.type, async () => {
		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Write', 0, '', true);
		for (const [uri, service] of host.services) {
			const globalDoc = service.languageService.getGlobalDoc();
			await fs.writeFile(uriToFsPath(globalDoc.uri), globalDoc.getText(), "utf8");
			const sourceFiles = service.languageService.getAllSourceFiles();
			let i = 0;
			for (const sourceFile of sourceFiles) {
				for (const [uri, doc] of sourceFile.getTsDocuments()) {
					if (progress.token.isCancellationRequested) {
						continue;
					}
					await fs.writeFile(uriToFsPath(uri), doc.getText(), "utf8");
				}
				progress.report(i++ / sourceFiles.length * 100, upath.relative(service.languageService.rootPath, sourceFile.fileName));
			}
		}
		progress.done();
	});
	connection.onRequest(VerifyAllScriptsRequest.type, async () => {
		const progress = await connection.window.createWorkDoneProgress();
		progress.begin('Verify', 0, '', true);
		for (const [uri, service] of host.services) {
			const sourceFiles = service.languageService.getAllSourceFiles();
			let i = 0;
			for (const sourceFile of sourceFiles) {
				if (progress.token.isCancellationRequested) {
					continue;
				}
				const doc = sourceFile.getTextDocument();
				await service.languageService.doValidation(doc, result => {
					connection.sendDiagnostics({ uri: doc.uri, diagnostics: result });
				});
				progress.report(i++ / sourceFiles.length * 100, upath.relative(service.languageService.rootPath, sourceFile.fileName));
			}
		}
		progress.done();
	});

	connection.onDocumentColor(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.findDocumentColors(document);
	});
	connection.onColorPresentation(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.getColorPresentations(document, handler.color, handler.range);
	});
	connection.onDocumentHighlight(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.findDocumentHighlights(document, handler.position);
	});
	connection.onDocumentSymbol(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.findDocumentSymbols(document);
	});
	connection.onDocumentLinks(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.findDocumentLinks(document);
	});
	connection.onFoldingRanges(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return host.best(document.uri)?.getFoldingRanges(document);
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
	connection.client.register(DocumentHighlightRequest.type, vueOnly);
	connection.client.register(DocumentSymbolRequest.type, vueOnly);
	connection.client.register(DocumentLinkRequest.type, vueOnly);
	connection.client.register(DocumentColorRequest.type, vueOnly);
	connection.client.register(FoldingRangeRequest.type, vueOnly);
	semanticTokensRequest = await connection.client.register(SemanticTokensRegistrationType.type, {
		documentSelector: vueOnly.documentSelector,
		legend: getSemanticTokensLegend(),
		range: true,
		full: true,
	});
}
