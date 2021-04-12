import { transformHover } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { Position } from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
    return (docDoc: PugDocument, pos: Position) => {

        const htmlRange = docDoc.sourceMap.getMappedRange(pos);
        if (!htmlRange) return;

        const htmlResult = htmlLs.doHover(
            docDoc.sourceMap.mappedDocument,
            htmlRange.start,
            docDoc.htmlDocument,
        );
        if (!htmlResult) return;

        return transformHover(
            htmlResult,
            htmlRange => docDoc.sourceMap.getSourceRange(htmlRange.start, htmlRange.end),
        );
    }
}
