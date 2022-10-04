import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { entriesToLocations } from '../../utils/transforms';
import { handleKindModifiers } from './basic';
import type { Data } from './basic';
import * as previewer from '../../utils/previewer';
import * as shared from '@volar/shared';
import type { GetConfiguration } from '../..';
import { URI } from 'vscode-uri';
import { getFormatCodeSettings } from '../../configs/getFormatCodeSettings';
import { getUserPreferences } from '../../configs/getUserPreferences';

export function register(
	rootUri: URI,
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	getConfiguration: GetConfiguration,
) {
	return async (item: vscode.CompletionItem, newPosition?: vscode.Position): Promise<vscode.CompletionItem> => {

		const data: Data | undefined = item.data;

		if (!data)
			return item;

		const fileName = data.fileName;
		let offset = data.offset;
		const document = getTextDocument(data.uri);

		if (newPosition && document) {
			offset = document.offsetAt(newPosition);
		}

		const [formatOptions, preferences] = document ? await Promise.all([
			getFormatCodeSettings(getConfiguration, document.uri),
			getUserPreferences(getConfiguration, document.uri, rootUri),
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
					const locs = entriesToLocations(rootUri, entries, getTextDocument);
					locs.forEach((loc, index) => {
						item.additionalTextEdits?.push(vscode.TextEdit.replace(loc.range, changes.textChanges[index].newText));
					});
				}
			}
		}
		if (details.displayParts) {
			detailTexts.push(previewer.plainWithLinks(details.displayParts, { toResource }, getTextDocument));
		}
		if (detailTexts.length) {
			item.detail = detailTexts.join('\n');
		}

		item.documentation = {
			kind: 'markdown',
			value: previewer.markdownDocumentation(details.documentation, details.tags, { toResource }, getTextDocument),
		};

		if (details) {
			handleKindModifiers(item, details);
		}

		return item;

		function toResource(path: string) {
			return shared.getUriByPath(rootUri, path);
		}
	};
}
