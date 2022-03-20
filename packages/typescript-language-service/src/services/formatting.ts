import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Settings } from '../';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	settings: Settings
) {
	return async (uri: string, options: vscode.FormattingOptions, range?: vscode.Range): Promise<vscode.TextEdit[]> => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const tsOptions = await settings.getFormatOptions?.(document, options) ?? options;

		let scriptEdits: ReturnType<typeof languageService.getFormattingEditsForRange> | undefined;
		try {
			scriptEdits = range
				? languageService.getFormattingEditsForRange(document.uri, document.offsetAt(range.start), document.offsetAt(range.end), tsOptions)
				: languageService.getFormattingEditsForDocument(document.uri, tsOptions);
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
			})
		}

		return result;
	};
}
