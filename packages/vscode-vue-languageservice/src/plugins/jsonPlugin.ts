import * as json from 'vscode-json-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { definePlugin } from './definePlugin';

export default definePlugin((host: {
    jsonLs: json.LanguageService,
}) => {

    const jsonDocuments = new WeakMap<TextDocument, [number, json.JSONDocument]>();

    return {

        triggerCharacters: ['"', ':'], // https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/json-language-features/server/src/jsonServer.ts#L150

        async doHover(textDocument, position) {

            const jsonDocument = getJsonDocument(textDocument);
            if (!jsonDocument)
                return;

            return host.jsonLs.doHover(textDocument, position, jsonDocument);
        },

        async doComplete(textDocument, position, context) {

            const jsonDocument = getJsonDocument(textDocument);
            if (!jsonDocument)
                return;

            return host.jsonLs.doComplete(textDocument, position, jsonDocument);
        },

        async doCompleteResolve(item) {
            return await host.jsonLs.doResolve(item);
        },
    };

    function getJsonDocument(textDocument: TextDocument) {

        if (textDocument.languageId !== 'json' && textDocument.languageId !== 'jsonc')
            return;

        const cache = jsonDocuments.get(textDocument);
        if (cache) {
            const [cacheVersion, cacheDoc] = cache;
            if (cacheVersion === textDocument.version) {
                return cacheDoc;
            }
        }

        const doc = host.jsonLs.parseJSONDocument(textDocument);
        jsonDocuments.set(textDocument, [textDocument.version, doc]);

        return doc;
    }
});
