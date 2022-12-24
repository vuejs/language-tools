import { transformSymbolInformations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument) => {

		const htmlResult = htmlLs.findDocumentSymbols(
			pugDoc.map.mappedDocument,
			pugDoc.htmlDocument,
		);

		return transformSymbolInformations(
			htmlResult,
			htmlLocation => {
				const range = pugDoc.map.toSourceRange(htmlLocation.range);
				if (range) {
					return {
						uri: pugDoc.map.sourceDocument.uri,
						range,
					};
				}
			},
		);
	};
}
