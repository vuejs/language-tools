import { TextDocument } from 'vscode-languageserver-textdocument';
import { definePlugin } from './definePlugin';
import * as ts2 from 'vscode-typescript-languageservice';

export default definePlugin((host: {
    tsLs: ts2.LanguageService,
}) => {

    return {

        triggerCharacters: ['@'],

        async doComplete(textDocument, position, context) {

            if (!isValidLanguage(textDocument))
                return;

            const commentComplete = host.tsLs.doDirectiveCommentComplete(textDocument.uri, position);

            if (commentComplete) {

                return {
                    isIncomplete: false,
                    items: commentComplete,
                }
            }
        },
    };

    function isValidLanguage(textDocument: TextDocument) {
        return textDocument.languageId === 'javascript' ||
            textDocument.languageId === 'typescript' ||
            textDocument.languageId === 'javascriptreact' ||
            textDocument.languageId === 'typescriptreact'
    }
});
