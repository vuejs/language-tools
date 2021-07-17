import type * as ts from 'typescript';
import {
	FormattingOptions,
	TextEdit,
	Range,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceHost } from '../';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost
) {
	return async (uri: string, options: FormattingOptions, range?: Range): Promise<TextEdit[]> => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = uriToFsPath(document.uri);
		const tsOptions = await host.getFormatOptions?.(document, options) ?? options;
		const scriptEdits = range
			? languageService.getFormattingEditsForRange(fileName, document.offsetAt(range.start), document.offsetAt(range.end), tsOptions)
			: languageService.getFormattingEditsForDocument(fileName, tsOptions)
		const result: TextEdit[] = [];

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
