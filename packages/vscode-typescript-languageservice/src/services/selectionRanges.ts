import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, positions: vscode.Position[]): vscode.SelectionRange[] => {

		const document = getTextDocument(uri);
		if (!document) return [];

		const result: vscode.SelectionRange[] = [];

		for (const position of positions) {
			const fileName = shared.uriToFsPath(document.uri);
			const offset = document.offsetAt(position);
			const range = languageService.getSmartSelectionRange(fileName, offset);
			result.push(transformSelectionRange(range, document));
		}

		return result;
	};
}

function transformSelectionRange(range: ts.SelectionRange, document: TextDocument): vscode.SelectionRange {
	return {
		range: vscode.Range.create(
			document.positionAt(range.textSpan.start),
			document.positionAt(range.textSpan.start + range.textSpan.length),
		),
		parent: range.parent ? transformSelectionRange(range.parent, document) : undefined,
	};
}
