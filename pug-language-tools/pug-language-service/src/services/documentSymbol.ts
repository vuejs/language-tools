import { transformer } from '@volar/language-service';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument) => {

		const htmlResult = htmlLs.findDocumentSymbols(
			pugDoc.map.virtualFileDocument,
			pugDoc.htmlDocument,
		);

		return transformer.asSymbolInformations(
			htmlResult,
			htmlLocation => {
				const range = pugDoc.map.toSourceRange(htmlLocation.range);
				if (range) {
					return {
						uri: pugDoc.map.sourceFileDocument.uri,
						range,
					};
				}
			},
		);
	};
}
