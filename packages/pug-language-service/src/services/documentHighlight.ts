import { transformLocations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, pos: html.Position) => {

		let htmlPos: html.Position | undefined;
		for (const mapped of pugDoc.sourceMap.toGeneratedPositions(pos)) {
			if (!mapped[1].data?.isEmptyTagCompletion) {
				htmlPos = mapped[0];
				break;
			}
		}
		if (!htmlPos)
			return;

		const htmlResult = htmlLs.findDocumentHighlights(
			pugDoc.sourceMap.mappedDocument,
			htmlPos,
			pugDoc.htmlDocument,
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
