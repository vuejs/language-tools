import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';
import * as ts2 from '@volar/typescript-language-service';
import { isTsDocument } from './typescript';

export const triggerCharacters = ['@'];

export default function (host: {
    getTsLs(): ts2.LanguageService,
}): EmbeddedLanguagePlugin {

    return {

        async doComplete(textDocument, position, context) {
            if (isTsDocument(textDocument)) {

                const commentComplete = host.getTsLs().doDirectiveCommentComplete(textDocument.uri, position);

                if (commentComplete) {

                    return {
                        isIncomplete: false,
                        items: commentComplete,
                    }
                }
            }
        },
    };
}
