import type * as ts from 'typescript';
import * as vscode from 'vscode-languageserver';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, position: vscode.Position): vscode.SelectionRange | undefined => {
		const document = getTextDocument(uri);
		if (!document) return;

		const fileName = shared.uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const range = languageService.getSmartSelectionRange(fileName, offset);
		return {
			range: vscode.Range.create(
				document.positionAt(range.textSpan.start),
				document.positionAt(range.textSpan.start + range.textSpan.length),
			)
		};
	};
}
