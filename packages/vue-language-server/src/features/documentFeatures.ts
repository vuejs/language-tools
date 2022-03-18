import * as shared from '@volar/shared';
import type * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vue from '@volar/vue-language-service';

export function register(
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	documentService: vue.DocumentService,
) {
	connection.onDocumentFormatting(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return documentService.format(document, handler.options);
	});
	connection.onSelectionRanges(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return documentService.getSelectionRanges(document, handler.positions);
	});
	connection.onFoldingRanges(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return documentService.getFoldingRanges(document);
	});
	connection.languages.onLinkedEditingRange(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return documentService.findLinkedEditingRanges(document, handler.position);
	});
	connection.onDocumentSymbol(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return documentService.findDocumentSymbols(document);
	});
	connection.onDocumentColor(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return documentService.findDocumentColors(document);
	});
	connection.onColorPresentation(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return documentService.getColorPresentations(document, handler.color, handler.range);
	});
	connection.onRequest(shared.AutoInsertRequest.type, async handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return documentService.doAutoInsert(document, handler.position, handler.options);
	});
}
