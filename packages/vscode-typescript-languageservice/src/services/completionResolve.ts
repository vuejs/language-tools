import type * as ts from 'typescript';
import { CompletionItem, TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { entriesToLocations } from '../utils/transforms';
import { handleKindModifiers } from './completion';
import type { Data } from './completion';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript')) {
	return (item: CompletionItem, newOffset?: number): CompletionItem => {
		const data: Data = item.data.__volar__;
		const fileName = data.fileName;
		const offset = newOffset ?? data.offset;
		const name = data.name;
		const source = data.source;
		const options = data.options;
		let detail: ts.CompletionEntryDetails | undefined;
		try {
			detail = languageService.getCompletionEntryDetails(fileName, offset, name, {}, source, options, item.data);
		}
		catch (err) {
			item.detail = `[TS Error] ${err}`;
		}
		const details: string[] = [];

		if (detail?.codeActions) {
			if (!item.additionalTextEdits) item.additionalTextEdits = [];
			for (const action of detail.codeActions) {
				details.push(action.description);
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

		if (detail?.displayParts) {
			details.push(ts.displayPartsToString(detail.displayParts));
		}
		if (detail?.documentation) {
			item.documentation = ts.displayPartsToString(detail.documentation);
		}
		if (details.length) item.detail = details.join('\n');

		if (detail) {
			handleKindModifiers(item, detail);
		}

		return item;
	};
}
