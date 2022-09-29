import { transformLocations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, docContext: html.DocumentContext) => {

		const htmlResult = htmlLs.findDocumentLinks(
			pugDoc.sourceMap.mappedDocument,
			docContext,
		);

		return transformLocations(
			htmlResult,
			htmlRange => {
				const start = pugDoc.sourceMap.toSourcePosition(htmlRange.start)?.[0];
				const end = pugDoc.sourceMap.toSourcePosition(htmlRange.end)?.[0];
				if (start && end) {
					return { start, end };
				}
			},
		);
	};
}
