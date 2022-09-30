import { transformHover } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, pos: html.Position, options?: html.HoverSettings | undefined) => {

		const htmlPos = pugDoc.sourceMap.toGeneratedPosition(pos, data => !data?.isEmptyTagCompletion);
		if (!htmlPos)
			return;

		const htmlResult = htmlLs.doHover(
			pugDoc.sourceMap.mappedDocument,
			htmlPos,
			pugDoc.htmlDocument,
			options,
		);
		if (!htmlResult) return;

		return transformHover(htmlResult, htmlRange => pugDoc.sourceMap.toSourceRange(htmlRange));
	};
}
