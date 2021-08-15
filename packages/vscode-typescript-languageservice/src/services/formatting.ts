import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceHost } from '../';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost
) {
	return async (uri: string, options: vscode.FormattingOptions, range?: vscode.Range): Promise<vscode.TextEdit[]> => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(document.uri);
		const tsOptions = await host.getFormatOptions?.(document, options) ?? options;
		const scriptEdits = range
			? languageService.getFormattingEditsForRange(fileName, document.offsetAt(range.start), document.offsetAt(range.end), tsOptions)
			: languageService.getFormattingEditsForDocument(fileName, tsOptions)
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
