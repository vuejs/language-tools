import * as ts from 'typescript';
import {
	CompletionItem,
} from 'vscode-languageserver';

export function register(languageService: ts.LanguageService) {
	return (item: CompletionItem): CompletionItem => {
		const fileName = item.data.fileName;
		const offset = item.data.offset;
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
