import type * as ts from 'typescript';
import {
	Position,
} from 'vscode-languageserver/node';
import { boundSpanToLocationLinks } from '../utils/transforms';
import { uriToFsPath } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, position: Position) => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const info = languageService.getDefinitionAndBoundSpan(fileName, offset);
		if (!info) return [];

		return boundSpanToLocationLinks(info, document, getTextDocument);
	};
}
