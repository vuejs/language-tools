import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';
import * as ts2 from '@volar/typescript-language-service';
import { isTsDocument } from './typescript';

export const triggerCharacters = ['*'];

export default function (host: {
    getTsLs(): ts2.LanguageService,
}): EmbeddedLanguagePlugin {

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
}
