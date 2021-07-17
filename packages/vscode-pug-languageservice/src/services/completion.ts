import { transformCompletionList } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { Position } from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return async (pugDoc: PugDocument, pos: Position, documentContext: html.DocumentContext, options?: html.CompletionConfiguration | undefined) => {

		const htmlRange = pugDoc.sourceMap.getMappedRange(pos);
		if (!htmlRange) return;

		const htmlComplete = await htmlLs.doComplete2(
			pugDoc.sourceMap.mappedDocument,
			htmlRange.start,
			pugDoc.htmlDocument,
			documentContext,
			options,
		);

		return transformCompletionList(
			htmlComplete,
			htmlRange => pugDoc.sourceMap.getSourceRange(htmlRange.start, htmlRange.end),
		);
	}
}
