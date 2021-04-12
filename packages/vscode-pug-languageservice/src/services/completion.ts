import { transformCompletionList } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { Position } from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
    return (pugDoc: PugDocument, pos: Position, options?: html.CompletionConfiguration | undefined) => {

        const htmlRange = pugDoc.sourceMap.getMappedRange(pos);
        if (!htmlRange) return;

        const htmlComplete = htmlLs.doComplete(
            pugDoc.sourceMap.mappedDocument,
            htmlRange.start,
            pugDoc.htmlDocument,
            options,
        );

        return transformCompletionList(
            htmlComplete,
            htmlRange => pugDoc.sourceMap.getSourceRange(htmlRange.start, htmlRange.end),
        );
    }
}
