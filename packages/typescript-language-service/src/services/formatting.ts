import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Settings } from '../';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	settings: Settings
) {
	return {
		onRange: async (uri: string, options: vscode.FormattingOptions, range?: vscode.Range): Promise<vscode.TextEdit[]> => {

			const document = getTextDocument(uri);
			if (!document) return [];

			const fileName = shared.uriToFsPath(document.uri);
			const tsOptions = await settings.getFormatOptions?.(document.uri, options) ?? options;

			let scriptEdits: ReturnType<typeof languageService.getFormattingEditsForRange> | undefined;
			try {
				scriptEdits = range
					? languageService.getFormattingEditsForRange(fileName, document.offsetAt(range.start), document.offsetAt(range.end), tsOptions)
					: languageService.getFormattingEditsForDocument(fileName, tsOptions);
			} catch { }
			if (!scriptEdits) return [];

			const result: vscode.TextEdit[] = [];

			for (const textEdit of scriptEdits) {
				result.push({
					range: {
						start: document.positionAt(textEdit.span.start),
						end: document.positionAt(textEdit.span.start + textEdit.span.length),
					},
					newText: textEdit.newText,
				});
			}

			return result;
		},
		onType: async (uri: string, options: vscode.FormattingOptions, position: vscode.Position, key: string): Promise<vscode.TextEdit[]> => {

			const document = getTextDocument(uri);
			if (!document) return [];

			const fileName = shared.uriToFsPath(document.uri);
			const tsOptions = await settings.getFormatOptions?.(document.uri, options) ?? options;

			let scriptEdits: ReturnType<typeof languageService.getFormattingEditsForRange> | undefined;
			try {
				scriptEdits = languageService.getFormattingEditsAfterKeystroke(fileName, document.offsetAt(position), key, tsOptions);
			} catch { }
			if (!scriptEdits) return [];

			const result: vscode.TextEdit[] = [];

			for (const textEdit of scriptEdits) {
				result.push({
					range: {
						start: document.positionAt(textEdit.span.start),
						end: document.positionAt(textEdit.span.start + textEdit.span.length),
					},
					newText: textEdit.newText,
				});
			}

			return result;
		},
	};
}
