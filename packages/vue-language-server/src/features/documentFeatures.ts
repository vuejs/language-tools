import type * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createSnapshots } from '../utils/snapshots';
import { AutoInsertRequest } from '../requests';
import { createDocumentServiceHost } from '../utils/documentServiceHost';

export function register(
	connection: vscode.Connection,
	documents: ReturnType<typeof createSnapshots>,
	documentServiceHost: ReturnType<typeof createDocumentServiceHost>,
) {
	connection.onDocumentFormatting(handler => {
		return worker(handler.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).format(document, handler.options);
		});
	});
	connection.onDocumentRangeFormatting(handler => {
		return worker(handler.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).format(document, handler.options, handler.range);
		});
	});
	connection.onDocumentOnTypeFormatting(handler => {
		return worker(handler.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).format(document, handler.options, undefined, handler);
		});
	});
	connection.onSelectionRanges(handler => {
		return worker(handler.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).getSelectionRanges(document, handler.positions);
		});
	});
	connection.onFoldingRanges(handler => {
		return worker(handler.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).getFoldingRanges(document);
		});
	});
	connection.languages.onLinkedEditingRange(handler => {
		return worker(handler.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).findLinkedEditingRanges(document, handler.position);
		});
	});
	connection.onDocumentSymbol(handler => {
		return worker(handler.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).findDocumentSymbols(document);
		});
	});
	connection.onDocumentColor(handler => {
		return worker(handler.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).findDocumentColors(document);
		});
	});
	connection.onColorPresentation(handler => {
		return worker(handler.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).getColorPresentations(document, handler.color, handler.range);
		});
	});
	connection.onRequest(AutoInsertRequest.type, async handler => {
		return worker(handler.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).doAutoInsert(document, handler.position, handler.options);
		});
	});

	function worker<T>(uri: string, cb: (document: TextDocument) => T) {
		const document = documents.data.uriGet(uri)?.getDocument();
		if (document) {
			return cb(document);
		}
	}
}
