import * as shared from '@volar/shared';
import { transformLocations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, posArr: html.Position[]) => {

		const htmlPosArr = posArr
			.map(position => pugDoc.sourceMap.getMappedRange(position, position, data => !data?.isEmptyTagCompletion)?.[0].start)
			.filter(shared.notEmpty);

		const htmlResult = htmlLs.getSelectionRanges(
			pugDoc.sourceMap.mappedDocument,
			htmlPosArr,
		);

		return transformLocations(
			htmlResult,
			htmlRange => pugDoc.sourceMap.getSourceRange(htmlRange.start, htmlRange.end)?.[0],
		);
	}
}
