import type { Position } from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';
import type * as html from 'vscode-html-languageservice';
import { transformHover } from '@volar/source-map';

export function register(htmlLanguageService: html.LanguageService) {
    return (pugDocument: PugDocument, position: Position) => {

        const htmlMaped = pugDocument.sourceMap.sourceToTarget({ start: position, end: position });
        if (!htmlMaped) return;

        const htmlResult = htmlLanguageService.doHover(
            pugDocument.sourceMap.targetDocument,
            htmlMaped.range.start,
            pugDocument.htmlDocument,
        );
        return transformHover(htmlResult, pugDocument.sourceMap);
    }
}
