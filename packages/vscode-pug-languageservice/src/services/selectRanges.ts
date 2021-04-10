import { notEmpty } from '@volar/shared';
import { transformLocations } from '@volar/source-map';
import type * as html from 'vscode-html-languageservice';
import type { Position, SelectionRange } from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
    return (pugDoc: PugDocument, posArr: Position[]): SelectionRange[] => {

        const htmlPosArr = posArr
            .map(position => pugDoc.sourceMap.getMappedRange(position)?.start)
            .filter(notEmpty);

        const htmlResult = htmlLs.getSelectionRanges(
            pugDoc.sourceMap.mappedDocument,
            htmlPosArr,
        );

        return transformLocations(htmlResult, pugDoc.sourceMap);
    }
}
