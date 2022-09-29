import { transformCompletionList } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return async (pugDoc: PugDocument, pos: html.Position, documentContext: html.DocumentContext, options?: html.CompletionConfiguration | undefined) => {

		let htmlPos: html.Position | undefined;
		for (const mapped of pugDoc.sourceMap.toGeneratedPositions(pos)) {
			if (!mapped[1].data?.isEmptyTagCompletion) {
				htmlPos = mapped[0];
				break;
			}
		}
		if (!htmlPos)
			return;

		const htmlComplete = await htmlLs.doComplete2(
			pugDoc.htmlTextDocument,
			htmlPos,
			pugDoc.htmlDocument,
			documentContext,
			options,
		);

		return transformCompletionList(
			htmlComplete,
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
