import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript/lib/tsserverlibrary';

namespace ExperimentalProto {
	export interface UserPreferences extends ts.UserPreferences {
		displayPartsForJSDoc: true

		includeInlayParameterNameHints?: 'none' | 'literals' | 'all';
		includeInlayParameterNameHintsWhenArgumentMatchesName?: boolean;
		includeInlayFunctionParameterTypeHints?: boolean;
		includeInlayVariableTypeHints?: boolean;
		includeInlayPropertyDeclarationTypeHints?: boolean;
		includeInlayFunctionLikeReturnTypeHints?: boolean;
		includeInlayEnumMemberValueHints?: boolean;
	}
}

export async function getFormatOptions(
	connection: vscode.Connection,
	document: TextDocument,
	options?: vscode.FormattingOptions
): Promise<ts.FormatCodeSettings> {
	let config = await connection.workspace.getConfiguration({
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
		insertSpaceAfterCommaDelimiter: config['insertSpaceAfterCommaDelimiter'] as boolean,
		insertSpaceAfterConstructor: config['insertSpaceAfterConstructor'] as boolean,
		insertSpaceAfterSemicolonInForStatements: config['insertSpaceAfterSemicolonInForStatements'] as boolean,
		insertSpaceBeforeAndAfterBinaryOperators: config['insertSpaceBeforeAndAfterBinaryOperators'] as boolean,
		insertSpaceAfterKeywordsInControlFlowStatements: config['insertSpaceAfterKeywordsInControlFlowStatements'] as boolean,
		insertSpaceAfterFunctionKeywordForAnonymousFunctions: config['insertSpaceAfterFunctionKeywordForAnonymousFunctions'] as boolean,
		insertSpaceBeforeFunctionParenthesis: config['insertSpaceBeforeFunctionParenthesis'] as boolean,
		insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: config['insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis'] as boolean,
		insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: config['insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets'] as boolean,
		insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: config['insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces'] as boolean,
		insertSpaceAfterOpeningAndBeforeClosingEmptyBraces: config['insertSpaceAfterOpeningAndBeforeClosingEmptyBraces'] as boolean,
		insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: config['insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces'] as boolean,
		insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: config['insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces'] as boolean,
		insertSpaceAfterTypeAssertion: config['insertSpaceAfterTypeAssertion'] as boolean,
		placeOpenBraceOnNewLineForFunctions: config['placeOpenBraceOnNewLineForFunctions'] as boolean,
		placeOpenBraceOnNewLineForControlBlocks: config['placeOpenBraceOnNewLineForControlBlocks'] as boolean,
		semicolons: config['semicolons'] as ts.SemicolonPreference,
	};
}

export async function getPreferences(
	connection: vscode.Connection,
	document: TextDocument
): Promise<ts.UserPreferences> {
	let [config, preferencesConfig] = await connection.workspace.getConfiguration([
		{
			section: isTypeScriptDocument(document) ? 'typescript' : 'javascript',
			scopeUri: document.uri
		},
		{
			section: isTypeScriptDocument(document) ? 'typescript.preferences' : 'javascript.preferences',
			scopeUri: document.uri
		}
	]);

	config = config ?? {};
	preferencesConfig = preferencesConfig ?? {};

	const preferences: ExperimentalProto.UserPreferences = {
		quotePreference: getQuoteStylePreference(preferencesConfig),
		importModuleSpecifierPreference: getImportModuleSpecifierPreference(preferencesConfig),
		importModuleSpecifierEnding: getImportModuleSpecifierEndingPreference(preferencesConfig),
		allowTextChangesInNewFiles: document.uri.startsWith('file://'),
		providePrefixAndSuffixTextForRename: (preferencesConfig['renameShorthandProperties'] as boolean ?? true) === false ? false : (preferencesConfig['useAliasesForRenames'] as boolean ?? true),
		// allowRenameOfImportPath: true,
		includeAutomaticOptionalChainCompletions: config['suggest.includeAutomaticOptionalChainCompletions'] ?? true,
		provideRefactorNotApplicableReason: true,
		// generateReturnInDocTemplate: config['suggest.jsdoc.generateReturns'] as boolean ?? true,
		includeCompletionsForImportStatements: config['suggest.includeCompletionsForImportStatements'] ?? true,
		includeCompletionsWithSnippetText: config['suggest.includeCompletionsWithSnippetText'] ?? true,
		displayPartsForJSDoc: true,
		...getInlayHintsPreferences(config),
	};

	return preferences;
}

function getQuoteStylePreference(config: any) {
	switch (config['quoteStyle'] as string) {
		case 'single': return 'single';
		case 'double': return 'double';
		default: return 'auto';
	}
}

function getInlayHintsPreferences(config: any) {
	return {
		includeInlayParameterNameHints: getInlayParameterNameHintsPreference(config),
		includeInlayParameterNameHintsWhenArgumentMatchesName: !(config['inlayHints.parameterNames.suppressWhenArgumentMatchesName'] ?? true),
		includeInlayFunctionParameterTypeHints: config['inlayHints.parameterTypes.enabled'] ?? false,
		includeInlayVariableTypeHints: config['inlayHints.variableTypes.enabled'] ?? false,
		includeInlayPropertyDeclarationTypeHints: config['inlayHints.propertyDeclarationTypes.enabled'] ?? false,
		includeInlayFunctionLikeReturnTypeHints: config['inlayHints.functionLikeReturnTypes.enabled'] ?? false,
		includeInlayEnumMemberValueHints: config['inlayHints.enumMemberValues.enabled'] ?? false,
	} as const;
}

function getInlayParameterNameHintsPreference(config: any) {
	switch (config['inlayHints.parameterNames.enabled'] as string) {
		case 'none': return 'none';
		case 'literals': return 'literals';
		case 'all': return 'all';
		default: return undefined;
	}
}

function getImportModuleSpecifierPreference(config: any) {
	switch (config['importModuleSpecifier'] as string) {
		case 'project-relative': return 'project-relative';
		case 'relative': return 'relative';
		case 'non-relative': return 'non-relative';
		default: return undefined;
	}
}

function getImportModuleSpecifierEndingPreference(config: any) {
	switch (config['importModuleSpecifierEnding'] as string) {
		case 'minimal': return 'minimal';
		case 'index': return 'index';
		case 'js': return 'js';
		default: return 'auto';
	}
}

function isTypeScriptDocument(doc: TextDocument) {
	return ['typescript', 'typescriptreact'].includes(doc.languageId);
}
