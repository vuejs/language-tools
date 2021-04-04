import type * as ts from 'typescript';
import { CompletionItem, TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { entriesToLocations } from '../utils/transforms';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript')) {
	return (item: CompletionItem, newOffset?: number): CompletionItem => {
		const fileName = item.data.fileName;
		const offset = newOffset ?? item.data.offset;
		const name = item.data.name;
		const source = item.data.source;
		const options = item.data.options;
		const detail = languageService.getCompletionEntryDetails(fileName, offset, name, {}, source, options);
		const details: string[] = [];
		if (detail?.source) {
			const importModule = ts.displayPartsToString(detail.source);
			const importPath = `'${importModule}'`;
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
				for (const changes of action.changes) {
					const entries = changes.textChanges.map(textChange => {
						return { fileName, textSpan: textChange.span }
					});
					const locs = entriesToLocations(entries, getTextDocument);
					locs.forEach((loc, index) => {
						item.additionalTextEdits?.push(TextEdit.replace(loc.range, changes.textChanges[index].newText))
					});
				}
			}
		}

		return item;
	};
}
