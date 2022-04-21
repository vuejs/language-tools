import * as shared from '@volar/shared';
import type * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vue from '@volar/vue-language-service';

export function register(
	connection: vscode.Connection,
	documents: vscode.TextDocuments<TextDocument>,
	vueDs: vue.DocumentService,
) {
	connection.onDocumentFormatting(handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.format(document, handler.options);
		});
	});
	connection.onSelectionRanges(handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.getSelectionRanges(document, handler.positions);
		});
	});
	connection.onFoldingRanges(handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.getFoldingRanges(document);
		});
	});
	connection.languages.onLinkedEditingRange(handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.findLinkedEditingRanges(document, handler.position);
		});
	});
	connection.onDocumentSymbol(handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.findDocumentSymbols(document);
		});
	});
	connection.onDocumentColor(handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.findDocumentColors(document);
		});
	});
	connection.onColorPresentation(handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.getColorPresentations(document, handler.color, handler.range);
		});
	});
	connection.onRequest(shared.AutoInsertRequest.type, async handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.doAutoInsert(document, handler.position, handler.options);
		});
	});

	function worker<T>(uri: string, cb: (document: TextDocument) => T) {
		const document = documents.get(uri);
		if (document) {
			return cb(document);
		}
	}
}
