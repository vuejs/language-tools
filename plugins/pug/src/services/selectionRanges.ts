import * as shared from '@volar/shared';
import { transformer } from '@volar/language-service';
import type * as html from 'vscode-html-languageservice';
import { MappingKind } from '../baseParse';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, posArr: html.Position[]) => {

		const htmlPosArr = posArr
			.map(position => pugDoc.map.toGeneratedPosition(position, data => data !== MappingKind.EmptyTagCompletion))
			.filter(shared.notEmpty);

		const htmlResult = htmlLs.getSelectionRanges(
			pugDoc.map.virtualFileDocument,
			htmlPosArr,
		);

		return transformer.asLocations(htmlResult, htmlRange => pugDoc.map.toSourceRange(htmlRange));
	};
}
