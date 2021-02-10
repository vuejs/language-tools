import type { Position } from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';
import type * as html from 'vscode-html-languageservice';
import { transformCompletionList } from '@volar/source-map';

export function register(htmlLanguageService: html.LanguageService) {
    return (pugDocument: PugDocument, position: Position, options?: html.CompletionConfiguration | undefined) => {

        const htmlMaped = pugDocument.sourceMap.sourceToTarget({ start: position, end: position });
        if (!htmlMaped) return;

        const htmlComplete = htmlLanguageService.doComplete(
            pugDocument.sourceMap.targetDocument,
            htmlMaped.range.start,
            pugDocument.htmlDocument,
            options,
        );
        return transformCompletionList(htmlComplete, pugDocument.sourceMap);
    }
}
