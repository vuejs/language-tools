import type { Position } from 'vscode-languageserver';
import type { SelectionRange } from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';
import type * as html from 'vscode-html-languageservice';
import { transformLocations } from '@volar/source-map';

export function register(htmlLanguageService: html.LanguageService) {
    return (pugDocument: PugDocument, positions: Position[]): SelectionRange[] => {

        const htmlPositions: Position[] = [];
        for (const position of positions) {
            const htmlRange = pugDocument.sourceMap.sourceToTarget(position);
            if (!htmlRange) continue;
            htmlPositions.push(htmlRange.start);
        }

        const htmlResult = htmlLanguageService.getSelectionRanges(
            pugDocument.sourceMap.targetDocument,
            htmlPositions,
        );
        return transformLocations(htmlResult, pugDocument.sourceMap);
    }
}
