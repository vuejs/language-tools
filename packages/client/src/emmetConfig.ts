import * as vscode from 'vscode';
import type { LanguageClient } from 'vscode-languageclient';
import {
	EmmetConfigurationRequest,
} from '@volar/shared';

export async function registerEmmetConfigurationRequestProvider(client: LanguageClient) {
	await client.onReady();
	client.onRequest(EmmetConfigurationRequest.type, getEmmetConfiguration);
}
function getEmmetConfiguration(syntax: string) {
	const emmetConfig = vscode.workspace.getConfiguration('emmet');
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
