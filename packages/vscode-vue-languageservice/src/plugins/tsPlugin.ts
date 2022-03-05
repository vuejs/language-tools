import { TextDocument } from 'vscode-languageserver-textdocument';
import { definePlugin } from './definePlugin';
import * as ts2 from 'vscode-typescript-languageservice';

export default definePlugin((host: {
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    tsLs: ts2.LanguageService,
    baseCompletionOptions: ts.GetCompletionsAtPositionOptions,
}) => {

    return {

        triggerCharacters: ts2.getTriggerCharacters(host.typescript.version),

        async doComplete(textDocument, position, context) {

            if (!isValidLanguage(textDocument))
                return;

            const options: ts.GetCompletionsAtPositionOptions = {
                ...host.baseCompletionOptions,
                triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
                triggerKind: context?.triggerKind,
            };

            return host.tsLs.doComplete(textDocument.uri, position, options);
        },

        async doCompleteResolve(item) {
            return host.tsLs.doCompletionResolve(item);
        },

        async doHover(textDocument, position) {

            if (!isValidLanguage(textDocument))
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
