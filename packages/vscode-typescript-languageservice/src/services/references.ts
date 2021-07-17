import type * as ts from 'typescript';
import * as vscode from 'vscode-languageserver';
import { entriesToLocations } from '../utils/transforms';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, position: vscode.Position): vscode.Location[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const entries = languageService.getReferencesAtPosition(fileName, offset);
		if (!entries) return [];

		return entriesToLocations([...entries], getTextDocument);
	};
}
