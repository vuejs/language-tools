import type { Position } from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';
import type * as html from 'vscode-html-languageservice';
import { transformCompletionList } from '@volar/source-map';

export function register(htmlLanguageService: html.LanguageService) {
    return (pugDocument: PugDocument, position: Position, options?: html.CompletionConfiguration | undefined) => {

        const htmlRange = pugDocument.sourceMap.getMappedRange(position);
        if (!htmlRange) return;

        const htmlComplete = htmlLanguageService.doComplete(
            pugDocument.sourceMap.mappedDocument,
            htmlRange.start,
            pugDocument.htmlDocument,
            options,
        );

        return transformCompletionList(htmlComplete, pugDocument.sourceMap);
    }
}
