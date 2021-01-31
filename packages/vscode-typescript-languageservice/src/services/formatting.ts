import type * as ts from 'typescript';
import {
	FormattingOptions,
	TextEdit,
	Range,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, options: FormattingOptions, range?: Range): TextEdit[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = uriToFsPath(document.uri);
		const tsOptions: ts.FormatCodeOptions | ts.FormatCodeSettings = {
			tabSize: options.tabSize,
			indentSize: options.tabSize,
			convertTabsToSpaces: options.insertSpaces,
			newLineCharacter: '\n',

			// todo
			// https://github.com/plastic-hub/pp-explorer/blob/53c3bbb748c29baa4e7c871f6e71ad8285a2b290/vscode/extensions/typescript/src/features/formattingConfigurationManager.ts#L41
			insertSpaceAfterCommaDelimiter: true,
			insertSpaceAfterConstructor: false,
			insertSpaceAfterSemicolonInForStatements: true,
			insertSpaceBeforeAndAfterBinaryOperators: true,
			insertSpaceAfterKeywordsInControlFlowStatements: true,
			insertSpaceAfterFunctionKeywordForAnonymousFunctions: false,
			insertSpaceBeforeFunctionParenthesis: false,
			insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
			insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
			insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
			insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
			insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
			insertSpaceAfterTypeAssertion: false,
			placeOpenBraceOnNewLineForFunctions: false,
			placeOpenBraceOnNewLineForControlBlocks: false
		}
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
