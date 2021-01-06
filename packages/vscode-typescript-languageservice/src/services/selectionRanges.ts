import type * as ts from 'typescript';
import {
	SelectionRange,
	TextDocument,
	Range,
	Position,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, position: Position): SelectionRange | undefined => {
		const document = getTextDocument(uri);
		if (!document) return;

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const range = languageService.getSmartSelectionRange(fileName, offset);
		return {
			range: Range.create(
				document.positionAt(range.textSpan.start),
				document.positionAt(range.textSpan.start + range.textSpan.length),
			)
		};
	};
}
