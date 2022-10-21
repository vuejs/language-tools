import { transformLocations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import { MappingKind } from '../baseParse';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, pos: html.Position) => {

		const htmlPos = pugDoc.sourceMap.toGeneratedPosition(pos, data => data !== MappingKind.EmptyTagCompletion);
		if (!htmlPos)
			return;

		const htmlResult = htmlLs.findDocumentHighlights(
			pugDoc.sourceMap.mappedDocument,
			htmlPos,
			pugDoc.htmlDocument,
		);

		return transformLocations(
			htmlResult,
			htmlRange => pugDoc.sourceMap.toSourceRange(htmlRange),
		);
	};
}
