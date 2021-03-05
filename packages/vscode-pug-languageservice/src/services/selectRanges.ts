import type { Position } from 'vscode-languageserver';
import type { SelectionRange } from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';
import type * as html from 'vscode-html-languageservice';
import { transformLocations } from '@volar/source-map';
import { notEmpty } from '@volar/shared';

export function register(htmlLanguageService: html.LanguageService) {
    return (pugDocument: PugDocument, positions: Position[]): SelectionRange[] => {

        const htmlPositions = positions
            .map(position => pugDocument.sourceMap.getMappedRange(position)?.start)
            .filter(notEmpty);

        const htmlResult = htmlLanguageService.getSelectionRanges(
            pugDocument.sourceMap.mappedDocument,
            htmlPositions,
        );

        return transformLocations(htmlResult, pugDocument.sourceMap);
    }
}
