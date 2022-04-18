import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { entriesToLocations } from '../../utils/transforms';
import { handleKindModifiers } from './basic';
import type { Data } from './basic';
import * as previewer from '../../utils/previewer';
import * as shared from '@volar/shared';
import type { Settings } from '../..';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	getTextDocument2: (uri: string) => TextDocument | undefined,
	settings: Settings,
) {
	return async (item: vscode.CompletionItem, newPosition?: vscode.Position): Promise<vscode.CompletionItem> => {

		const data: Data | undefined = item.data as any;

		if (!data)
			return item;

		const fileName = data.fileName;
		let offset = data.offset;
		const document = getTextDocument(data.uri);

		if (newPosition && document) {
			offset = document.offsetAt(newPosition);
		}

		const [formatOptions, preferences] = document ? await Promise.all([
			settings.getFormatOptions?.(document) ?? {},
			settings.getPreferences?.(document) ?? {},
		]) : [{}, {}];

		let details: ts.CompletionEntryDetails | undefined;
		try {
			details = languageService.getCompletionEntryDetails(fileName, offset, data.originalItem.name, formatOptions, data.originalItem.source, preferences, data.originalItem.data);
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
						return { fileName, textSpan: textChange.span };
					});
					const locs = entriesToLocations(entries, getTextDocument2);
					locs.forEach((loc, index) => {
						item.additionalTextEdits?.push(vscode.TextEdit.replace(loc.range, changes.textChanges[index].newText));
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
