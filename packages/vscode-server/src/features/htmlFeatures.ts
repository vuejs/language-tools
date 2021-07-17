import { TagCloseRequest } from '@volar/shared';
import { DocumentLanguageService } from 'vscode-vue-languageservice';
import { TextDocument } from 'vscode-css-languageservice';
import { Connection, TextDocuments } from 'vscode-languageserver/node';

export function register(
	connection: Connection,
	documents: TextDocuments<TextDocument>,
	noStateLs: DocumentLanguageService,
) {
	connection.onDocumentFormatting(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return noStateLs.doFormatting(document, handler.options);
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
	connection.onRequest(TagCloseRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return noStateLs.doTagComplete(document, handler.position);
	});
}
