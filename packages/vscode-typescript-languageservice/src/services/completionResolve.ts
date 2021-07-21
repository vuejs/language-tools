import type * as ts from 'typescript';
import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { entriesToLocations } from '../utils/transforms';
import { handleKindModifiers } from './completion';
import type { Data } from './completion';
import * as previewer from '../utils/previewer';
import * as shared from '@volar/shared';
import type { LanguageServiceHost } from '../';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	getTextDocument2: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost
) {
	return async (item: vscode.CompletionItem, newOffset?: number): Promise<vscode.CompletionItem> => {

		const data: Data = item.data;
		const fileName = data.fileName;
		const offset = newOffset ?? data.offset;
		const name = data.name;
		const source = data.source;

		const document = getTextDocument(data.uri);
		const [formatOptions, preferences] = document ? await Promise.all([
			host.getFormatOptions?.(document) ?? {},
			host.getPreferences?.(document) ?? {},
		]) : [{}, {}];

		let details: ts.CompletionEntryDetails | undefined;
		try {
			details = languageService.getCompletionEntryDetails(fileName, offset, name, formatOptions, source, preferences, data.tsData);
		}
		catch (err) {
			item.detail = `[TS Error] ${err}`;
		}

		if (!details)
			return item;

		const detailTexts: string[] = [];
		if (details.codeActions) {
			if (!item.additionalTextEdits) item.additionalTextEdits = [];
			for (const action of details.codeActions) {
				detailTexts.push(action.description);
				for (const changes of action.changes) {
					const entries = changes.textChanges.map(textChange => {
						return { fileName, textSpan: textChange.span }
					});
					const locs = entriesToLocations(entries, getTextDocument);
					locs.forEach((loc, index) => {
						item.additionalTextEdits?.push(vscode.TextEdit.replace(loc.range, changes.textChanges[index].newText))
					});
				}
			}
		}
		if (details.displayParts) {
			detailTexts.push(previewer.plainWithLinks(details.displayParts, { toResource: shared.fsPathToUri }));
		}
		if (detailTexts.length) {
			item.detail = detailTexts.join('\n');
		}

		item.documentation = {
			kind: 'markdown',
			value: previewer.markdownDocumentation(details.documentation, details.tags, { toResource: shared.fsPathToUri }, getTextDocument2),
		};

		if (details) {
			handleKindModifiers(item, details);
		}

		return item;
	};
}
