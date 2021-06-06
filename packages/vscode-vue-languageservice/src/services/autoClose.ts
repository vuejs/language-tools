import type { HtmlApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as sharedLs from '../utils/sharedLs';

export function register({ getHtmlDocument }: HtmlApiRegisterOptions) {
	return (document: TextDocument, position: Position): string | undefined | null => {
		return sharedLs.htmlLs.doTagComplete(document, position, getHtmlDocument(document));
	}
}
