import { TextDocument } from 'vscode-languageserver-textdocument';
import { definePlugin } from './definePlugin';
import * as ts2 from 'vscode-typescript-languageservice';

export default definePlugin((host) => {

    const triggerCharacters = ts2.getTriggerCharacters(host.typescript.version);

    return {
        async onCompletion(textDocument, position, context) {

            if (context.triggerCharacter && !triggerCharacters.includes(context.triggerCharacter))
                return;

            if (!isValidLanguage(textDocument))
                return;

            if (!host.tsLs)
                return;

            return host.tsLs.doComplete(textDocument.uri, position);
        },

        async onCompletionResolve(item) {

            if (!host.tsLs)
                return item;

            return host.tsLs.doCompletionResolve(item);
        },

        async onHover(textDocument, position) {

            if (!isValidLanguage(textDocument))
                return;

            if (!host.tsLs)
                return;

            return host.tsLs.doHover(textDocument.uri, position);
        },
    };

    function isValidLanguage(textDocument: TextDocument) {
        return textDocument.languageId === 'javascript' ||
            textDocument.languageId === 'typescript' ||
            textDocument.languageId === 'javascriptreact' ||
            textDocument.languageId === 'typescriptreact' ||
            textDocument.languageId === 'json'
    }
});
