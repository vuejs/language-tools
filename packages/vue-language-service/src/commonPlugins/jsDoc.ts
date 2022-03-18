import { EmbeddedLanguageServicePlugin } from '@volar/vue-language-service-types';
import * as ts2 from '@volar/typescript-language-service';
import { isTsDocument } from './typescript';

export default function (host: {
    getTsLs(): ts2.LanguageService,
}): EmbeddedLanguageServicePlugin {

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
