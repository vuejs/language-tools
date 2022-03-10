import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { Configuration } from 'vscode-languageserver/lib/common/configuration';

export async function getFormatOptions(
	configuration: Configuration | undefined,
	document: TextDocument,
	options?: vscode.FormattingOptions
): Promise<ts.FormatCodeSettings> {

	let config = await configuration?.getConfiguration({
		section: isTypeScriptDocument(document) ? 'typescript.format' : 'javascript.format',
		scopeUri: document.uri
	});

	config = config ?? {};

	return {
		tabSize: options?.tabSize,
		indentSize: options?.tabSize,
		convertTabsToSpaces: options?.insertSpaces,
		// We can use \n here since the editor normalizes later on to its line endings.
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

export async function getPreferences(
	configuration: Configuration | undefined,
	document: TextDocument
): Promise<ts.UserPreferences> {
	let [config, preferencesConfig] = await configuration?.getConfiguration([
		{
			section: isTypeScriptDocument(document) ? 'typescript' : 'javascript',
			scopeUri: document.uri
		},
		{
			section: isTypeScriptDocument(document) ? 'typescript.preferences' : 'javascript.preferences',
			scopeUri: document.uri
		}
	]) ?? [undefined, undefined];

	config = config ?? {};
	preferencesConfig = preferencesConfig ?? {};

	const preferences: ts.UserPreferences & { displayPartsForJSDoc: true } = {
		quotePreference: getQuoteStylePreference(preferencesConfig),
		importModuleSpecifierPreference: getImportModuleSpecifierPreference(preferencesConfig),
		importModuleSpecifierEnding: getImportModuleSpecifierEndingPreference(preferencesConfig),
		allowTextChangesInNewFiles: document.uri.startsWith('file://'),
		providePrefixAndSuffixTextForRename: (preferencesConfig.renameShorthandProperties ?? true) === false ? false : (preferencesConfig.useAliasesForRenames ?? true),
		// @ts-ignore
		allowRenameOfImportPath: true,
		includeAutomaticOptionalChainCompletions: config.suggest?.includeAutomaticOptionalChainCompletions ?? true,
		provideRefactorNotApplicableReason: true,
		generateReturnInDocTemplate: config.suggest?.jsdoc?.generateReturns ?? true,
		includeCompletionsForImportStatements: config.suggest?.includeCompletionsForImportStatements ?? true,
		includeCompletionsWithSnippetText: config.suggest?.includeCompletionsWithSnippetText ?? true,
		allowIncompleteCompletions: true,
		displayPartsForJSDoc: true,

		// custom
		includeCompletionsForModuleExports: config.suggest?.autoImports ?? true,
	};

	return preferences;
}

function getQuoteStylePreference(config: any) {
	switch (config.quoteStyle as string) {
		case 'single': return 'single';
		case 'double': return 'double';
		default: return 'auto';
	}
}

function getImportModuleSpecifierPreference(config: any) {
	switch (config.importModuleSpecifier as string) {
		case 'project-relative': return 'project-relative';
		case 'relative': return 'relative';
		case 'non-relative': return 'non-relative';
		default: return undefined;
	}
}

function getImportModuleSpecifierEndingPreference(config: any) {
	switch (config.importModuleSpecifierEnding as string) {
		case 'minimal': return 'minimal';
		case 'index': return 'index';
		case 'js': return 'js';
		default: return 'auto';
	}
}

function isTypeScriptDocument(doc: TextDocument) {
	return ['typescript', 'typescriptreact'].includes(doc.languageId);
}
