import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { entriesToLocations } from '../../utils/transforms';
import { handleKindModifiers } from './basic';
import type { Data } from './basic';
import * as previewer from '../../utils/previewer';
import * as shared from '@volar/shared';
import type { GetConfiguration } from '../../createLanguageService';
import { URI } from 'vscode-uri';
import { getFormatCodeSettings } from '../../configs/getFormatCodeSettings';
import { getUserPreferences } from '../../configs/getUserPreferences';
import { snippetForFunctionCall } from '../../utils/snippetForFunctionCall';
import { isTypeScriptDocument } from '../../configs/shared';

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
			item.detail = `[TS Error] ${JSON.stringify(err)}`;
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

		if (document) {

			const useCodeSnippetsOnMethodSuggest = await getConfiguration<boolean>((isTypeScriptDocument(document.uri) ? 'typescript' : 'javascript') + '.suggest.completeFunctionCalls') ?? false;
			const useCodeSnippet = useCodeSnippetsOnMethodSuggest && (item.kind === vscode.CompletionItemKind.Function || item.kind === vscode.CompletionItemKind.Method);

			if (useCodeSnippet) {
				const shouldCompleteFunction = isValidFunctionCompletionContext(languageService, fileName, offset, document);
				if (shouldCompleteFunction) {
					const { snippet, parameterCount } = snippetForFunctionCall(item, details.displayParts);
					if (item.textEdit) {
						item.textEdit.newText = snippet;
					}
					if (item.insertText) {
						item.insertText = snippet;
					}
					item.insertTextFormat = vscode.InsertTextFormat.Snippet;
					if (parameterCount > 0) {
						//Fix for https://github.com/microsoft/vscode/issues/104059
						//Don't show parameter hints if "editor.parameterHints.enabled": false
						// if (await getConfiguration('editor.parameterHints.enabled', document.uri)) {
						// 	item.command = {
						// 		title: 'triggerParameterHints',
						// 		command: 'editor.action.triggerParameterHints',
						// 	};
						// }
					}
				}
			}
		}

		return item;

		function toResource(path: string) {
			return shared.getUriByPath(path);
		}
	};
}

function isValidFunctionCompletionContext(
	client: ts.LanguageService,
	filepath: string,
	offset: number,
	document: TextDocument,
): boolean {
	// Workaround for https://github.com/microsoft/TypeScript/issues/12677
	// Don't complete function calls inside of destructive assignments or imports
	try {
		const response = client.getQuickInfoAtPosition(filepath, offset);
		if (response) {
			switch (response.kind) {
				case 'var':
				case 'let':
				case 'const':
				case 'alias':
					return false;
			}
		}
	} catch {
		// Noop
	}

	// Don't complete function call if there is already something that looks like a function call
	// https://github.com/microsoft/vscode/issues/18131
	const position = document.positionAt(offset);
	const after = getLineText(document, position.line).slice(position.character);
	return after.match(/^[a-z_$0-9]*\s*\(/gi) === null;
}

export function getLineText(document: TextDocument, line: number) {
	const endOffset = document.offsetAt({ line: line + 1, character: 0 });
	const end = document.positionAt(endOffset);
	const text = document.getText({
		start: { line: line, character: 0 },
		end: end.line === line ? end : document.positionAt(endOffset - 1),
	});
	return text;
}
