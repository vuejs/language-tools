import { definePlugin } from './definePlugin';
import * as ts2 from 'vscode-typescript-languageservice';
import { isTsDocument } from './tsPlugin';

export default definePlugin((host: {
    tsLs: ts2.LanguageService,
}) => {

    return {

        triggerCharacters: ['*'],

        doComplete(textDocument, position, context) {
            if (isTsDocument(textDocument)) {

                const jsDocComplete = host.tsLs.doJsDocComplete(textDocument.uri, position);

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
