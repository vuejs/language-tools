import type { DocumentServiceRuntimeContext } from '../types';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ getHtmlDocument, htmlLs }: DocumentServiceRuntimeContext) {
	return (document: TextDocument, position: vscode.Position): vscode.LinkedEditingRanges | null => {
		const htmlDoc = getHtmlDocument(document);
		if (htmlDoc) {
			const ranges = htmlLs.findLinkedEditingRanges(document, position, htmlDoc);
			if (ranges) {
				return { ranges };
			}
		}
		return null;
	}
}
