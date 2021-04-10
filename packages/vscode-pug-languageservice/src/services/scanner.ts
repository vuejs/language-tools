import * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
    return (pugDoc: PugDocument, initialOffset = 0) => {

        let htmlRange = pugDoc.sourceMap.getMappedRange2(initialOffset);
        while (!htmlRange && initialOffset < pugDoc.pugCode.length) {
            initialOffset++;
            htmlRange = pugDoc.sourceMap.getMappedRange2(initialOffset);
        }
        if (!htmlRange) return;

        const htmlScanner = htmlLs.createScanner(pugDoc.htmlCode, htmlRange.start);

        let token = html.TokenType.Unknown;
        let offset = 0;
        let end = 0;

        return {
            scan,
            getTokenType: () => token,
            getTokenOffset: () => offset,
            getTokenLength: htmlScanner.getTokenLength,
            getTokenEnd: () => end,
            getTokenText: () => pugDoc.pugCode.substring(offset, end),
            getTokenError: htmlScanner.getTokenError,
            getScannerState: htmlScanner.getScannerState,
        };

        function scan() {
            token = htmlScanner.scan();
            const htmlOffset = htmlScanner.getTokenOffset();
            const htmlEnd = htmlScanner.getTokenEnd();
            const pugRange = pugDoc.sourceMap.getSourceRange2(htmlOffset, htmlEnd);
            if (pugRange) {
                offset = pugRange.start;
                end = pugRange.end;
                return token;
            }
            else {
                return html.TokenType.Unknown;
            }
        }
    }
}
