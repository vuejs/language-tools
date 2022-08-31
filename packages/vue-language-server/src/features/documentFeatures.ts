import * as shared from '@volar/shared';
import type * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vue from '@volar/vue-language-service';
import { createSnapshots } from '../utils/snapshots';

export function register(
	connection: vscode.Connection,
	documents: ReturnType<typeof createSnapshots>,
	vueDs: vue.DocumentService,
	allowedLanguageIds: string[] = [
		'vue',
		'javascript',
		'typescript',
		'javascriptreact',
		'typescriptreact',
	],
) {
	connection.onDocumentFormatting(handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.format(document, handler.options);
		});
	});
	connection.onDocumentRangeFormatting(handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.format(document, handler.options, handler.range);
		});
	});
	connection.onDocumentOnTypeFormatting(handler => {
		return worker(handler.textDocument.uri, document => {
			return vueDs.format(document, handler.options, undefined, handler);
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
		const document = documents.data.uriGet(uri)?.getDocument();
		if (document && allowedLanguageIds.includes(document.languageId)) {
			return cb(document);
		}
	}
}
