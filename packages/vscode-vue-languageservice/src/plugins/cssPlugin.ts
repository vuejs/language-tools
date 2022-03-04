import { definePlugin } from './definePlugin';
import * as css from 'vscode-css-languageservice';

export default definePlugin((host) => {

    return {
        async onHover(textDocument, position) {

            const stylesheet = host.getStylesheet(textDocument);
            if (!stylesheet)
                return;

            const cssLs = host.getCssLs(textDocument.languageId);
            if (!cssLs)
                return;

            const settings = await host.getSettings<css.LanguageSettings>(textDocument.languageId, textDocument.uri);

            return cssLs.doHover(textDocument, position, stylesheet, settings?.hover);
        },
    };
});
