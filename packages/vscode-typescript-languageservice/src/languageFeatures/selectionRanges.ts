import * as ts from 'typescript';
import {
	SelectionRange,
	TextDocument,
	Range,
	Position,
} from 'vscode-languageserver';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService) {
	return (document: TextDocument, position: Position): SelectionRange | undefined => {
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
