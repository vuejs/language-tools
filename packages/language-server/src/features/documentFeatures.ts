import type * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createSnapshots } from '../utils/snapshots';
import { AutoInsertRequest } from '../protocol';
import { createDocumentServiceHost } from '../utils/documentServiceHost';

export function register(
	connection: vscode.Connection,
	documents: ReturnType<typeof createSnapshots>,
	documentServiceHost: ReturnType<typeof createDocumentServiceHost>,
) {
	connection.onDocumentFormatting(params => {
		return worker(params.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).format(document, params.options);
		});
	});
	connection.onDocumentRangeFormatting(params => {
		return worker(params.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).format(document, params.options, params.range);
		});
	});
	connection.onDocumentOnTypeFormatting(params => {
		return worker(params.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).format(document, params.options, undefined, params);
		});
	});
	connection.onSelectionRanges(params => {
		return worker(params.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).getSelectionRanges(document, params.positions);
		});
	});
	connection.onFoldingRanges(params => {
		return worker(params.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).getFoldingRanges(document);
		});
	});
	connection.languages.onLinkedEditingRange(params => {
		return worker(params.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).findLinkedEditingRanges(document, params.position);
		});
	});
	connection.onDocumentSymbol(params => {
		return worker(params.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).findDocumentSymbols(document);
		});
	});
	connection.onDocumentColor(params => {
		return worker(params.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).findDocumentColors(document);
		});
	});
	connection.onColorPresentation(params => {
		return worker(params.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).getColorPresentations(document, params.color, params.range);
		});
	});
	connection.onRequest(AutoInsertRequest.type, async params => {
		return worker(params.textDocument.uri, document => {
			return documentServiceHost.get(document.uri).doAutoInsert(document, params.position, params.options);
		});
	});

	function worker<T>(uri: string, cb: (document: TextDocument) => T) {
		const document = documents.data.uriGet(uri)?.getDocument();
		if (document) {
			return cb(document);
		}
	}
}
