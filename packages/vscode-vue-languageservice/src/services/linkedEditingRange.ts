import type { HtmlApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { LinkedEditingRanges } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as languageServices from '../utils/languageServices';

export function register({ getHtmlDocument }: HtmlApiRegisterOptions) {
	return (document: TextDocument, position: Position): LinkedEditingRanges | null => {
		const ranges = languageServices.html.findLinkedEditingRanges(document, position, getHtmlDocument(document));
		if (ranges) {
			return { ranges };
		}
		return null;
	}
}
