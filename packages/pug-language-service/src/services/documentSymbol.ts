import { transformSymbolInformations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument) => {

		const htmlResult = htmlLs.findDocumentSymbols(
			pugDoc.sourceMap.mappedDocument,
			pugDoc.htmlDocument,
		);

		return transformSymbolInformations(
			htmlResult,
			htmlLocation => {
				const start = pugDoc.sourceMap.toSourcePosition(htmlLocation.range.start)?.[0];
				const end = pugDoc.sourceMap.toSourcePosition(htmlLocation.range.end)?.[0];
				if (start && end) {
					return {
						uri: pugDoc.sourceMap.sourceDocument.uri,
						range: { start, end },
					};
				}
			},
		);
	};
}
