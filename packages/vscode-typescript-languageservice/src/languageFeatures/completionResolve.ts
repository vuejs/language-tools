import * as ts from 'typescript';
import { CompletionItem, TextEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { entriesToLocations } from '../utils/transforms';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (item: CompletionItem): CompletionItem => {
		const fileName = item.data.fileName;
		const offset = item.data.offset;
		const name = item.data.name;
		const source = item.data.source;
		const detail = languageService.getCompletionEntryDetails(fileName, offset, name, {}, source, {
			includeCompletionsForModuleExports: true,
			includeCompletionsWithInsertText: true,
		});
		const details: string[] = [];
		if (detail?.source) {
			const importPath = `'${ts.displayPartsToString(detail.source)}'`;
			const autoImportLabel = `Auto import from ${importPath}`;
			details.push(autoImportLabel);
		}
		if (detail?.displayParts) {
			details.push(ts.displayPartsToString(detail.displayParts));
		}
		if (detail?.documentation) {
			item.documentation = ts.displayPartsToString(detail.documentation);
		}
		if (details.length) item.detail = details.join('\n');

		if (detail?.codeActions) {
			if (!item.additionalTextEdits) item.additionalTextEdits = [];
			for (const action of detail.codeActions) {
				for (const change of action.changes) {
					const entries = change.textChanges.map(textChange => {
						return { fileName, textSpan: textChange.span }
					});
					const locs = entriesToLocations(entries, getTextDocument);
					locs.forEach((loc, index) => {
						item.additionalTextEdits?.push(TextEdit.insert(loc.range.start, change.textChanges[index].newText))
					});
				}
			}
		}

		return item;
	};
}
