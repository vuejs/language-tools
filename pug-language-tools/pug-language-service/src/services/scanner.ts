import type * as html from 'vscode-html-languageservice';
import { MappingKind } from '../baseParse';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, initialOffset = 0) => {

		const htmlOffset = pugDoc.map.map.mappings
			.filter(mapping => mapping.sourceRange[0] >= initialOffset && mapping.data !== MappingKind.EmptyTagCompletion)
			.sort((a, b) => a.generatedRange[0] - b.generatedRange[0])[0]
			?.generatedRange[0];

		if (htmlOffset === undefined)
			return;

		const htmlScanner = htmlLs.createScanner(pugDoc.htmlTextDocument.getText(), htmlOffset);

		// @ts-expect-error
		const scanner: html.Scanner = {
			scan: () => {
				return htmlScanner.scan();
			},
			getTokenOffset: () => {
				return pugDoc.map.map.toSourceOffset(htmlScanner.getTokenOffset())?.[0] ?? -1;
			},
			getTokenEnd: () => {
				return pugDoc.map.map.toSourceOffset(htmlScanner.getTokenEnd())?.[0] ?? -1;
			},
			getTokenText: htmlScanner.getTokenText,
			getTokenLength: htmlScanner.getTokenLength,
			getTokenError: htmlScanner.getTokenError,
			getScannerState: htmlScanner.getScannerState,
		};

		return scanner;
	};
}
