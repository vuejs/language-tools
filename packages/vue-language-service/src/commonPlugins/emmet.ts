import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';
import * as emmet from '@vscode/emmet-helper';

export const triggerCharacters = []; // TODO

export default function (host: {
    getSettings: <S>(section: string, scopeUri?: string | undefined) => Promise<S | undefined>,
}): EmbeddedLanguagePlugin {

    let emmetConfig: any;

    return {

        async doComplete(textDocument, position) {

            const syntax = emmet.getEmmetMode(textDocument.languageId === 'vue' ? 'html' : textDocument.languageId);
            if (!syntax)
                return;

            const emmetConfig = await getEmmetConfig(syntax);

            return emmet.doComplete(textDocument, position, syntax, emmetConfig);
        },
    };

    async function getEmmetConfig(syntax: string): Promise<emmet.VSCodeEmmetConfig> {

        emmetConfig = await host.getSettings<emmet.VSCodeEmmetConfig>('emmet') ?? {};

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
