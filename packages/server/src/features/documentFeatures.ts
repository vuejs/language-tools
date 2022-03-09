import * as shared from '@volar/shared';
import type * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vue from 'vscode-vue-languageservice';

export function register(
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	noStateLs: vue.DocumentService,
) {
	connection.onDocumentFormatting(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return noStateLs.format(document, handler.options);
	});
	connection.onSelectionRanges(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return noStateLs.getSelectionRanges(document, handler.positions);
	});
	connection.onFoldingRanges(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return noStateLs.getFoldingRanges(document);
	});
	connection.languages.onLinkedEditingRange(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return noStateLs.findLinkedEditingRanges(document, handler.position);
	});
	connection.onDocumentSymbol(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return noStateLs.findDocumentSymbols(document);
	});
	connection.onDocumentColor(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return noStateLs.findDocumentColors(document);
	});
	connection.onColorPresentation(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return noStateLs.getColorPresentations(document, handler.color, handler.range);
	});
	connection.onRequest(shared.AutoInsertRequest.type, async handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return noStateLs.doAutoInsert(document, handler.position, handler.options);
	});
}
