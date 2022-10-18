import type { LanguageServicePlugin, LanguageServicePluginContext } from '@volar/language-service';
import * as emmet from '@vscode/emmet-helper';

export default function (): LanguageServicePlugin {

	let context: LanguageServicePluginContext;

	return {

		setup(_context) {
			context = _context;
		},

		complete: {

			// https://docs.emmet.io/abbreviations/syntax/
			triggerCharacters: '>+^*()#.[]$@-{}'.split(''),

			isAdditional: true,

			async on(textDocument, position) {

				const syntax = emmet.getEmmetMode(textDocument.languageId === 'vue' ? 'html' : textDocument.languageId);
				if (!syntax)
					return;

				// monkey fix https://github.com/johnsoncodehk/volar/issues/1105
				if (syntax === 'jsx')
					return;

				const emmetConfig = await getEmmetConfig(syntax);

				return emmet.doComplete(textDocument, position, syntax, emmetConfig);
			},
		},
	};

	async function getEmmetConfig(syntax: string): Promise<emmet.VSCodeEmmetConfig> {

		const emmetConfig: any = await context.env.configurationHost?.getConfiguration<emmet.VSCodeEmmetConfig>('emmet') ?? {};
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
