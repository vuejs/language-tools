import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, pos: html.Position, options?: html.CompletionConfiguration | undefined) => {

		const htmlStart = pugDoc.sourceMap.toGeneratedPosition(pos);
		if (!htmlStart) return;

		const text = htmlLs.doQuoteComplete(
			pugDoc.htmlTextDocument,
			htmlStart,
			pugDoc.htmlDocument,
			options,
		);

		return text;
	};
}
