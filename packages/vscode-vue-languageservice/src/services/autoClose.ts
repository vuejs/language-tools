import type { HtmlLanguageServiceContext } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ getHtmlDocument, htmlLs }: HtmlLanguageServiceContext) {
	return (document: TextDocument, position: Position): string | undefined | null => {
		return htmlLs.doTagComplete(document, position, getHtmlDocument(document));
	}
}
