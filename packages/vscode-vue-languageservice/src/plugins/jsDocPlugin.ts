import { definePlugin } from './definePlugin';
import * as ts2 from 'vscode-typescript-languageservice';
import { isTsDocument } from './tsPlugin';

export const triggerCharacters = ['*'];

export default definePlugin((host: {
    getTsLs(): ts2.LanguageService,
}) => {

    return {

        doComplete(textDocument, position, context) {
            if (isTsDocument(textDocument)) {

                const jsDocComplete = host.getTsLs().doJsDocComplete(textDocument.uri, position);

                if (jsDocComplete) {
                    return {
                        isIncomplete: false,
                        items: [jsDocComplete],
                    }
                }
            }
        },
    };
});
