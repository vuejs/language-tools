import type * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';

export function getDocumentSafely(documents: vscode.TextDocuments<TextDocument>, uri: string) {

	const normalizeUri = shared.normalizeUri(uri);
	const document = documents.get(uri) ?? documents.get(normalizeUri);

	if (document) {
		return document;
	}

	for (const document of documents.all()) {
		if (shared.normalizeUri(document.uri).toLowerCase() === normalizeUri.toLowerCase()) {
			return document;
		}
	}
}
