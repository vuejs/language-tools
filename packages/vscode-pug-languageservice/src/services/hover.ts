import type { Position } from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';
import type * as html from 'vscode-html-languageservice';
import { transformHover } from '@volar/source-map';

export function register(htmlLanguageService: html.LanguageService) {
    return (pugDocument: PugDocument, position: Position) => {

        const htmlRange = pugDocument.sourceMap.getMappedRange(position);
        if (!htmlRange) return;

        const htmlResult = htmlLanguageService.doHover(
            pugDocument.sourceMap.mappedDocument,
            htmlRange.start,
            pugDocument.htmlDocument,
        );
        if (!htmlResult) return;

        return transformHover(htmlResult, pugDocument.sourceMap);
    }
}
