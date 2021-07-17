import type * as ts from 'typescript';
import type * as vscode from 'vscode-languageserver';
import { entriesToLocationLinks } from '../utils/transforms';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, position: vscode.Position) => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const entries = languageService.getTypeDefinitionAtPosition(fileName, offset);
		if (!entries) return [];

		return entriesToLocationLinks([...entries], getTextDocument);
	};
}
