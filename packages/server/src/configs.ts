import * as vue from 'vscode-vue-languageservice';
import type * as emmet from '@vscode/emmet-helper';
import * as vscode from 'vscode-languageserver';

let emmetConfig: any = {};

export function updateConfigs(connection: vscode.Connection) {

	updateCodeLensConfig();
	updateEmmetConfig();

	async function updateCodeLensConfig() {
		const [
			codeLensReferences,
			codeLensPugTool,
			codeLensRefScriptSetupTool,
		] = await Promise.all([
			connection.workspace.getConfiguration('volar.codeLens.references'),
			connection.workspace.getConfiguration('volar.codeLens.pugTools'),
			connection.workspace.getConfiguration('volar.codeLens.scriptSetupTools'),
		]);
		vue.codeLensOptions.references = codeLensReferences;
		vue.codeLensOptions.pugTool = codeLensPugTool;
		vue.codeLensOptions.scriptSetupTool = codeLensRefScriptSetupTool;
	}
	async function updateEmmetConfig() {
		emmetConfig = (await connection.workspace.getConfiguration('emmet')) ?? {};
	}
}
export function getEmmetConfiguration(syntax: string): emmet.VSCodeEmmetConfig {
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
