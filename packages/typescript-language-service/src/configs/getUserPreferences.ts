import { GetConfiguration } from '..';
import { isTypeScriptDocument } from './shared';

export async function getUserPreferences(
	getConfiguration: GetConfiguration,
	uri: string,
): Promise<ts.UserPreferences> {

	let config = await getConfiguration(isTypeScriptDocument(uri) ? 'typescript' : 'javascript', uri);
	let preferencesConfig = await getConfiguration(isTypeScriptDocument(uri) ? 'typescript.preferences' : 'javascript.preferences', uri);

	config = config ?? {};
	preferencesConfig = preferencesConfig ?? {};

	const preferences: ts.UserPreferences = {
		quotePreference: getQuoteStylePreference(preferencesConfig),
		importModuleSpecifierPreference: getImportModuleSpecifierPreference(preferencesConfig),
		importModuleSpecifierEnding: getImportModuleSpecifierEndingPreference(preferencesConfig),
		allowTextChangesInNewFiles: uri.startsWith('file://'),
		providePrefixAndSuffixTextForRename: (preferencesConfig.renameShorthandProperties ?? true) === false ? false : (preferencesConfig.useAliasesForRenames ?? true),
		// @ts-ignore
		allowRenameOfImportPath: true,
		includeAutomaticOptionalChainCompletions: config.suggest?.includeAutomaticOptionalChainCompletions ?? true,
		provideRefactorNotApplicableReason: true,
		// @ts-ignore
		includeCompletionsForImportStatements: config.suggest?.includeCompletionsForImportStatements ?? true,
		includeCompletionsWithSnippetText: config.suggest?.includeCompletionsWithSnippetText ?? true,
		allowIncompleteCompletions: true,
		// @ts-ignore
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
		default: return 'minimal'; // fix https://github.com/johnsoncodehk/volar/issues/1667
		// default: return 'auto';
	}
}

function getInlayParameterNameHintsPreference(config: any) {
	switch (config.inlayHints?.parameterNames?.enabled) {
		case 'none': return 'none';
		case 'literals': return 'literals';
		case 'all': return 'all';
		default: return undefined;
	}
}
