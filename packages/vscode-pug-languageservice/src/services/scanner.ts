import type { PugDocument } from '../pugDocument';
import * as html from 'vscode-html-languageservice';

export function register(htmlLanguageService: html.LanguageService) {
    return (pugDocument: PugDocument, initialOffset = 0) => {

        let htmlRange = pugDocument.sourceMap.getMappedRange2(initialOffset);
        while (!htmlRange && initialOffset < pugDocument.pug.length) {
            initialOffset++;
            htmlRange = pugDocument.sourceMap.getMappedRange2(initialOffset);
        }
        if (!htmlRange) return;

        const htmlScanner = htmlLanguageService.createScanner(pugDocument.html, htmlRange.start);

        let token = html.TokenType.Unknown;
        let offset = 0;
        let end = 0;

        return {
            scan,
            getTokenType: () => token,
            getTokenOffset: () => offset,
            getTokenLength: htmlScanner.getTokenLength,
            getTokenEnd: () => end,
            getTokenText: () => pugDocument.pug.substring(offset, end),
            getTokenError: htmlScanner.getTokenError,
            getScannerState: htmlScanner.getScannerState,
        };

        function scan() {
            token = htmlScanner.scan();
            const htmlOffset = htmlScanner.getTokenOffset();
            const htmlEnd = htmlScanner.getTokenEnd();
            const pugRange = pugDocument.sourceMap.getSourceRange2(htmlOffset, htmlEnd);
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
