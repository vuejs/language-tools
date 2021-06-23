import type { HtmlLanguageServiceContext } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { LinkedEditingRanges } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ getHtmlDocument, htmlLs }: HtmlLanguageServiceContext) {
	return (document: TextDocument, position: Position): LinkedEditingRanges | null => {
		const ranges = htmlLs.findLinkedEditingRanges(document, position, getHtmlDocument(document));
		if (ranges) {
			return { ranges };
		}
		return null;
	}
}
