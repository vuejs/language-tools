import * as ts from 'typescript';
import {
	CompletionItem, TextEdit,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { entriesToLocations } from '../utils/transforms';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (item: CompletionItem): CompletionItem => {
		const fileName = item.data.fileName;
		const offset = item.data.offset;
		const detail = languageService.getCompletionEntryDetails(fileName, offset, item.label, {}, item.data.source, {
			includeCompletionsForModuleExports: true,
			includeCompletionsWithInsertText: true,
		});
		if (detail) {
			item.detail = ts.displayPartsToString(detail.displayParts);
		}
		if (detail?.documentation) {
			item.documentation = ts.displayPartsToString(detail.documentation);
		}
		if (detail?.codeActions) {
			if (!item.additionalTextEdits) item.additionalTextEdits = [];
			detail.codeActions.map(action => {
				action.changes.map(change => {
					const entries = change.textChanges.map(textChange => {
						return { fileName, textSpan: textChange.span }
					});
					let locs = entriesToLocations(entries, getTextDocument);
					locs.map((loc, index) => {
						item.additionalTextEdits?.push(TextEdit.insert(loc.range.start, change.textChanges[index].newText))
					});

				})
			})
		}
		return item;
	};
}
