import { EmbeddedLanguageServicePlugin, useConfigurationHost } from '@volar/vue-language-service-types';
import * as emmet from '@vscode/emmet-helper';

export default function (): EmbeddedLanguageServicePlugin {

    let emmetConfig: any;

    return {

        async doComplete(textDocument, position) {

            const syntax = emmet.getEmmetMode(textDocument.languageId === 'vue' ? 'html' : textDocument.languageId);
            if (!syntax)
                return;

            // monkey fix https://github.com/johnsoncodehk/volar/issues/1105
            if (syntax === 'jsx')
                return;

            const emmetConfig = await getEmmetConfig(syntax);

            return emmet.doComplete(textDocument, position, syntax, emmetConfig);
        },
    };

    async function getEmmetConfig(syntax: string): Promise<emmet.VSCodeEmmetConfig> {

        emmetConfig = await useConfigurationHost()?.getConfiguration<emmet.VSCodeEmmetConfig>('emmet') ?? {};

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
