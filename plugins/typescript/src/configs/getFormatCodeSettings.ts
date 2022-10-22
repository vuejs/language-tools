import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import type { GetConfiguration } from '../createLanguageService';
import { isTypeScriptDocument } from './shared';

export async function getFormatCodeSettings(
	getConfiguration: GetConfiguration,
	uri: string,
	options?: vscode.FormattingOptions,
): Promise<ts.FormatCodeSettings> {

	let config = await getConfiguration(isTypeScriptDocument(uri) ? 'typescript.format' : 'javascript.format', uri);

	config = config ?? {};

	return {
		convertTabsToSpaces: options?.insertSpaces,
		tabSize: options?.tabSize,
		indentSize: options?.tabSize,
		indentStyle: 2 /** ts.IndentStyle.Smart */,
		newLineCharacter: '\n',
		insertSpaceAfterCommaDelimiter: config.insertSpaceAfterCommaDelimiter ?? true,
		insertSpaceAfterConstructor: config.insertSpaceAfterConstructor ?? false,
		insertSpaceAfterSemicolonInForStatements: config.insertSpaceAfterSemicolonInForStatements ?? true,
		insertSpaceBeforeAndAfterBinaryOperators: config.insertSpaceBeforeAndAfterBinaryOperators ?? true,
		insertSpaceAfterKeywordsInControlFlowStatements: config.insertSpaceAfterKeywordsInControlFlowStatements ?? true,
		insertSpaceAfterFunctionKeywordForAnonymousFunctions: config.insertSpaceAfterFunctionKeywordForAnonymousFunctions ?? true,
		insertSpaceBeforeFunctionParenthesis: config.insertSpaceBeforeFunctionParenthesis ?? false,
		insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: config.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis ?? false,
		insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: config.insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets ?? false,
		insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: config.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces ?? true,
		insertSpaceAfterOpeningAndBeforeClosingEmptyBraces: config.insertSpaceAfterOpeningAndBeforeClosingEmptyBraces ?? true,
		insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: config.insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces ?? false,
		insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: config.insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces ?? false,
		insertSpaceAfterTypeAssertion: config.insertSpaceAfterTypeAssertion ?? false,
		placeOpenBraceOnNewLineForFunctions: config.placeOpenBraceOnNewLineForFunctions ?? false,
		placeOpenBraceOnNewLineForControlBlocks: config.placeOpenBraceOnNewLineForControlBlocks ?? false,
		semicolons: config.semicolons ?? 'ignore',
	};
}
