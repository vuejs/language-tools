import { transformCompletionList } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import { MappingKind } from '../baseParse';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return async (pugDoc: PugDocument, pos: html.Position, documentContext: html.DocumentContext, options?: html.CompletionConfiguration | undefined) => {

		const htmlPos = pugDoc.sourceMap.toGeneratedPosition(pos, data => data !== MappingKind.EmptyTagCompletion);
		if (!htmlPos)
			return;

		const htmlComplete = await htmlLs.doComplete2(
			pugDoc.htmlTextDocument,
			htmlPos,
			pugDoc.htmlDocument,
			documentContext,
			options,
		);

		return transformCompletionList(htmlComplete, htmlRange => pugDoc.sourceMap.toSourceRange(htmlRange));
	};
}
