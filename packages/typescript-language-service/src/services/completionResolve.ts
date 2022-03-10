import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
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
	return async (item: vscode.CompletionItem, newPosition?: vscode.Position): Promise<vscode.CompletionItem> => {

		// @ts-expect-error
		const data: Data = item.data;
		const fileName = data.fileName;
		const name = data.name;
		const source = data.source;
		let offset = data.offset;
		const document = getTextDocument(data.uri);

		if (newPosition && document) {
			offset = document.offsetAt(newPosition);
		}

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
					const locs = entriesToLocations(entries, getTextDocument2);
					locs.forEach((loc, index) => {
						item.additionalTextEdits?.push(vscode.TextEdit.replace(loc.range, changes.textChanges[index].newText))
					});
				}
			}
		}
		if (details.displayParts) {
			detailTexts.push(previewer.plainWithLinks(details.displayParts, { toResource: shared.fsPathToUri }, getTextDocument2));
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
