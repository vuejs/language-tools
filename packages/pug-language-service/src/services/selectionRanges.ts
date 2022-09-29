import * as shared from '@volar/shared';
import { transformLocations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, posArr: html.Position[]) => {

		const htmlPosArr = posArr
			.map(position => {
				for (const mapped of pugDoc.sourceMap.toGeneratedPositions(position)) {
					if (!mapped[1].data?.isEmptyTagCompletion) {
						return mapped[0];
					}
				}
			})
			.filter(shared.notEmpty);

		const htmlResult = htmlLs.getSelectionRanges(
			pugDoc.sourceMap.mappedDocument,
			htmlPosArr,
		);

		return transformLocations(
			htmlResult,
			htmlRange => {
				const start = pugDoc.sourceMap.toSourcePosition(htmlRange.start)?.[0];
				const end = pugDoc.sourceMap.toSourcePosition(htmlRange.end)?.[0];
				if (start && end) {
					return { start, end };
				}
			},
		);
	};
}
