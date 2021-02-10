import type { PugDocument } from '../pugDocument';
import * as html from 'vscode-html-languageservice';

export function register(htmlLanguageService: html.LanguageService) {
    return (pugDocument: PugDocument, initialOffset = 0) => {

        let htmlMaped = pugDocument.sourceMap.sourceToTarget2({ start: initialOffset, end: initialOffset });
        while (!htmlMaped && initialOffset < pugDocument.pug.length) {
            initialOffset++;
            htmlMaped = pugDocument.sourceMap.sourceToTarget2({ start: initialOffset, end: initialOffset });
        }
        if (!htmlMaped) return;

        const htmlScanner = htmlLanguageService.createScanner(pugDocument.html, htmlMaped.range.start);

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
            const pugMaped = pugDocument.sourceMap.targetToSource2({ start: htmlOffset, end: htmlEnd });
            if (pugMaped) {
                offset = pugMaped.range.start;
                end = pugMaped.range.end;
                return token;
            }
            else {
                return html.TokenType.Unknown;
            }
        }
    }
}
