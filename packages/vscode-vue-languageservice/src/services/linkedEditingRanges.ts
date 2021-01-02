import type { Position } from 'vscode-languageserver/node';
import type { LinkedEditingRanges } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { HTMLDocument } from 'vscode-html-languageservice';
import * as globalServices from '../globalServices';

export function register(getHtmlDocument: (doc: TextDocument) => HTMLDocument) {
	return (document: TextDocument, position: Position): LinkedEditingRanges | null => {
		const ranges = globalServices.html.findLinkedEditingRanges(document, position, getHtmlDocument(document));
		if (ranges) {
			return { ranges };
		}
		return null;
	}
}
