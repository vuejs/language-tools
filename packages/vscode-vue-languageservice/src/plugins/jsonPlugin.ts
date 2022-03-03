import * as json from 'vscode-json-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { definePlugin } from './definePlugin';

export default definePlugin((host) => {

    const triggerCharacters = ['"', ':'];
    const jsonLs = json.getLanguageService({ schemaRequestService: host.schemaRequestService });
    const jsonDocuments = new WeakMap<TextDocument, [number, json.JSONDocument]>();

    return {
        async onCompletion(textDocument, position, context) {

            if (context.triggerCharacter && !triggerCharacters.includes(context.triggerCharacter))
                return;

            const jsonDocument = getJsonDocument(textDocument);
            if (!jsonDocument)
                return;

            return await jsonLs.doComplete(textDocument, position, jsonDocument) ?? undefined;
        },

        async onCompletionResolve(item) {
            return await jsonLs.doResolve(item);
        },

        async onHover(textDocument, position) {

            const jsonDocument = getJsonDocument(textDocument);
            if (!jsonDocument)
                return;

            return await jsonLs.doHover(textDocument, position, jsonDocument) ?? undefined;
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

        const doc = jsonLs.parseJSONDocument(textDocument);
        jsonDocuments.set(textDocument, [textDocument.version, doc]);

        return doc;
    }
});
