import { transformer } from '@volar/language-service';
import type * as html from 'vscode-html-languageservice';
import { MappingKind } from '../baseParse';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, pos: html.Position) => {

		const htmlPos = pugDoc.map.toGeneratedPosition(pos, data => data !== MappingKind.EmptyTagCompletion);
		if (!htmlPos)
			return;

		const htmlResult = htmlLs.findDocumentHighlights(
			pugDoc.map.virtualFileDocument,
			htmlPos,
			pugDoc.htmlDocument,
		);

		return transformer.asLocations(
			htmlResult,
			htmlRange => pugDoc.map.toSourceRange(htmlRange),
		);
	};
}
