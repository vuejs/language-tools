import { definePlugin } from './definePlugin';

export default definePlugin((host) => {

    return {
        async onHover(textDocument, position) {

            const stylesheet = host.getStylesheet(textDocument);
            if (!stylesheet)
                return;

            const cssLs = host.getCssLs(textDocument.languageId);
            if (!cssLs)
                return;

            return await cssLs.doHover(textDocument, position, stylesheet) ?? undefined;
        },
    };
});
