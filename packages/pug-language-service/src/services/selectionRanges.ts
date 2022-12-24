import * as shared from '@volar/shared';
import { transformLocations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import { MappingKind } from '../baseParse';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, posArr: html.Position[]) => {

		const htmlPosArr = posArr
			.map(position => pugDoc.map.toGeneratedPosition(position, data => data !== MappingKind.EmptyTagCompletion))
			.filter(shared.notEmpty);

		const htmlResult = htmlLs.getSelectionRanges(
			pugDoc.map.mappedDocument,
			htmlPosArr,
		);

		return transformLocations(htmlResult, htmlRange => pugDoc.map.toSourceRange(htmlRange));
	};
}
