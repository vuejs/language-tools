import { transformLocations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, docContext: html.DocumentContext) => {

		const htmlResult = htmlLs.findDocumentLinks(
			pugDoc.map.virtualFileDocument,
			docContext,
		);

		return transformLocations(
			htmlResult,
			htmlRange => pugDoc.map.toSourceRange(htmlRange),
		);
	};
}
