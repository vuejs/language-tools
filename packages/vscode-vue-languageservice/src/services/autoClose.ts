import { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as globalServices from '../globalServices';

export function register() {
	return (document: TextDocument, position: Position): string | undefined | null => {
		return globalServices.html.doTagComplete(document, position, globalServices.html.parseHTMLDocument(document));
	}
}
