import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as vscode from 'vscode-languageserver-protocol';
import * as ts2 from '@volar/typescript-language-service';
import { ConfigurationHost } from '@volar/vue-language-service-types';

export function getTsSettings(configurationHost: ConfigurationHost | undefined) {
	const tsSettings: ts2.Settings = {
		getFormatOptions: (document, options) => getFormatOptions(configurationHost, document, options),
		getPreferences: (document) => getPreferences(configurationHost, document),
	};
	return tsSettings;
}

export async function getFormatOptions(
	configurationHost: ConfigurationHost | undefined,
	document: TextDocument,
	options?: vscode.FormattingOptions
): Promise<ts.FormatCodeSettings> {

	let config = await configurationHost?.getConfiguration<any>(isTypeScriptDocument(document) ? 'typescript.format' : 'javascript.format', document.uri);

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
	configurationHost: ConfigurationHost | undefined,
	document: TextDocument
): Promise<ts.UserPreferences> {

	let config = await configurationHost?.getConfiguration<any>(isTypeScriptDocument(document) ? 'typescript' : 'javascript', document.uri);
	let preferencesConfig = await configurationHost?.getConfiguration<any>(isTypeScriptDocument(document) ? 'typescript.preferences' : 'javascript.preferences', document.uri);

	config = config ?? {};
	preferencesConfig = preferencesConfig ?? {};

	const preferences: ts.UserPreferences & { displayPartsForJSDoc: true; } = {
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

		// inlay hints
		includeInlayParameterNameHints: getInlayParameterNameHintsPreference(config),
		includeInlayParameterNameHintsWhenArgumentMatchesName: !(config.inlayHints?.parameterNames?.suppressWhenArgumentMatchesName ?? true),
		includeInlayFunctionParameterTypeHints: config.inlayHints?.parameterTypes?.enabled ?? false,
		includeInlayVariableTypeHints: config.inlayHints?.variableTypes?.enabled ?? false,
		includeInlayPropertyDeclarationTypeHints: config.inlayHints?.propertyDeclarationTypes?.enabled ?? false,
		includeInlayFunctionLikeReturnTypeHints: config.inlayHints?.functionLikeReturnTypes?.enabled ?? false,
		includeInlayEnumMemberValueHints: config.inlayHints?.enumMemberValues?.enabled ?? false,

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

function getInlayParameterNameHintsPreference(config: any) {
	switch (config.inlayHints?.parameterNames?.enabled) {
		case 'none': return 'none';
		case 'literals': return 'literals';
		case 'all': return 'all';
		default: return undefined;
	}
}
