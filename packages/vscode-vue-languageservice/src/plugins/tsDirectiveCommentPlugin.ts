import { definePlugin } from './definePlugin';
import * as ts2 from 'vscode-typescript-languageservice';
import { isTsDocument } from './tsPlugin';

export default definePlugin((host: {
    tsLs: ts2.LanguageService,
}) => {

    return {

        triggerCharacters: ['@'],

        async doComplete(textDocument, position, context) {
            if (isTsDocument(textDocument)) {

                const commentComplete = host.tsLs.doDirectiveCommentComplete(textDocument.uri, position);

                if (commentComplete) {
    
                    return {
                        isIncomplete: false,
                        items: commentComplete,
                    }
                }
            }
        },
    };
});
