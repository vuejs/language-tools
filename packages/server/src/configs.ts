import type * as emmet from '@vscode/emmet-helper';
import * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as tsConfigs from './tsConfigs';
import * as css from 'vscode-css-languageservice';

export function createLsConfigs(connection: vscode.Connection) {

	let emmetConfig: any | undefined;
	let tsPreferences: Record<string, Promise<ts.UserPreferences>> = {};
	let tsFormatOptions: Record<string, Promise<ts.FormatCodeSettings>> = {};
	let cssLanguageSettings: Record<string, Promise<css.LanguageSettings>> = {};
	let codeLensConfigs: {
		references: boolean,
		pugTool: boolean,
		scriptSetupTool: boolean,
	} | undefined;

	connection.onDidChangeConfiguration(() => {
		emmetConfig = undefined;
		codeLensConfigs = undefined;
		tsPreferences = {};
		tsFormatOptions = {};
		cssLanguageSettings = {};
	});

	return {
		getCodeLensConfigs,
		getEmmetConfiguration,
		getCssLanguageSettings,
		getTsPreferences,
		getTsFormatOptions,
	};

	function getTsPreferences(textDocument: TextDocument) {
		return tsPreferences[textDocument.uri]
			?? (tsPreferences[textDocument.uri] = tsConfigs.getPreferences(connection, textDocument));
	}
	function getTsFormatOptions(textDocument: TextDocument, options?: vscode.FormattingOptions) {
		return tsFormatOptions[textDocument.uri]
			?? (tsFormatOptions[textDocument.uri] = tsConfigs.getFormatOptions(connection, textDocument, options));
	}
	function getCssLanguageSettings(textDocument: TextDocument): Promise<css.LanguageSettings> {
		return cssLanguageSettings[textDocument.uri]
			?? (cssLanguageSettings[textDocument.uri] = connection.workspace.getConfiguration({ scopeUri: textDocument.uri, section: textDocument.languageId }));
	}
	async function getCodeLensConfigs() {
		if (!codeLensConfigs) {
			const [
				codeLensReferences,
				codeLensPugTool,
				codeLensRefScriptSetupTool,
			] = await Promise.all([
				connection.workspace.getConfiguration('volar.codeLens.references'),
				connection.workspace.getConfiguration('volar.codeLens.pugTools'),
				connection.workspace.getConfiguration('volar.codeLens.scriptSetupTools'),
			]);
			codeLensConfigs = {
				references: codeLensReferences,
				pugTool: codeLensPugTool,
				scriptSetupTool: codeLensRefScriptSetupTool,
			};
		}
		return codeLensConfigs;
	}
	async function getEmmetConfiguration(syntax: string): Promise<emmet.VSCodeEmmetConfig> {

		if (!emmetConfig) {
			emmetConfig = (await connection.workspace.getConfiguration('emmet')) ?? {};
		}

		const syntaxProfiles = Object.assign({}, emmetConfig['syntaxProfiles'] || {});
		const preferences = Object.assign({}, emmetConfig['preferences'] || {});
		// jsx, xml and xsl syntaxes need to have self closing tags unless otherwise configured by user
		if (syntax === 'jsx' || syntax === 'xml' || syntax === 'xsl') {
			syntaxProfiles[syntax] = syntaxProfiles[syntax] || {};
			if (typeof syntaxProfiles[syntax] === 'object'
				&& !syntaxProfiles[syntax].hasOwnProperty('self_closing_tag') // Old Emmet format
				&& !syntaxProfiles[syntax].hasOwnProperty('selfClosingStyle') // Emmet 2.0 format
			) {
				syntaxProfiles[syntax] = {
					...syntaxProfiles[syntax],
					selfClosingStyle: 'xml'
				};
			}
		}

		return {
			preferences,
			showExpandedAbbreviation: emmetConfig['showExpandedAbbreviation'],
			showAbbreviationSuggestions: emmetConfig['showAbbreviationSuggestions'],
			syntaxProfiles,
			variables: emmetConfig['variables'],
			excludeLanguages: emmetConfig['excludeLanguages'],
			showSuggestionsAsSnippets: emmetConfig['showSuggestionsAsSnippets']
		};
	}
}
