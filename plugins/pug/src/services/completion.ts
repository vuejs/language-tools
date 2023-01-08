import { transformer } from '@volar/language-service';
import type * as html from 'vscode-html-languageservice';
import { MappingKind } from '../baseParse';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return async (pugDoc: PugDocument, pos: html.Position, documentContext: html.DocumentContext | undefined, options?: html.CompletionConfiguration | undefined) => {

		const htmlPos = pugDoc.map.toGeneratedPosition(pos, data => data !== MappingKind.EmptyTagCompletion);
		if (!htmlPos)
			return;

		const htmlComplete = documentContext ? await htmlLs.doComplete2(
			pugDoc.htmlTextDocument,
			htmlPos,
			pugDoc.htmlDocument,
			documentContext,
			options,
		) : htmlLs.doComplete(
			pugDoc.htmlTextDocument,
			htmlPos,
			pugDoc.htmlDocument,
			options,
		);

		return transformer.asCompletionList(htmlComplete, htmlRange => pugDoc.map.toSourceRange(htmlRange), pugDoc.map.virtualFileDocument);
	};
}
