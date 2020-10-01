import * as ts from 'typescript';
import {
	TextDocument,
	CompletionItem,
	Position,
} from 'vscode-languageserver';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService) {
	return (document: TextDocument, position: Position, item: CompletionItem): CompletionItem => {
		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const detail = languageService.getCompletionEntryDetails(fileName, offset, item.label, undefined, undefined, undefined);
		if (detail) {
			item.detail = ts.displayPartsToString(detail.displayParts);
		}
		if (detail?.documentation) {
			item.documentation = ts.displayPartsToString(detail.documentation);
		}
		return item;
	};
}
