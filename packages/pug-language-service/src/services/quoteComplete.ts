import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, pos: html.Position, options?: html.CompletionConfiguration | undefined) => {

		const htmlRange = pugDoc.sourceMap.getMappedRange(pos)?.[0];
		if (!htmlRange) return;

		const text = htmlLs.doQuoteComplete(
			pugDoc.htmlTextDocument,
			htmlRange.start,
			pugDoc.htmlDocument,
			options,
		);

		return text;
	};
}
