import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, initialOffset = 0) => {

		let htmlRange = pugDoc.sourceMap.getMappedRange(initialOffset, initialOffset, data => !data?.isEmptyTagCompletion)?.[0];
		while (!htmlRange && initialOffset < pugDoc.pugCode.length) {
			initialOffset++;
			htmlRange = pugDoc.sourceMap.getMappedRange(initialOffset, initialOffset, data => !data?.isEmptyTagCompletion)?.[0];
		}
		if (!htmlRange) return;

		const htmlScanner = htmlLs.createScanner(pugDoc.htmlCode, htmlRange.start);

		let offset: number | undefined;
		let end: number | undefined;

		// @ts-expect-error
		const scanner: html.Scanner = {
			scan: () => {
				offset = undefined;
				end = undefined;
				return htmlScanner.scan();
			},
			getTokenOffset: () => {
				getTokenRange();
				return offset!;
			},
			getTokenEnd: () => {
				getTokenRange();
				return end!;
			},
			getTokenText: htmlScanner.getTokenText,
			getTokenLength: htmlScanner.getTokenLength,
			getTokenError: htmlScanner.getTokenError,
			getScannerState: htmlScanner.getScannerState,
		};

		return scanner;

		function getTokenRange() {
			if (offset === undefined || end === undefined) {
				const htmlOffset = htmlScanner.getTokenOffset();
				const htmlEnd = htmlScanner.getTokenEnd();
				const pugRange = pugDoc.sourceMap.getSourceRange(htmlOffset, htmlEnd)?.[0];
				if (pugRange) {
					offset = pugRange.start;
					end = pugRange.end;
				}
				else {
					offset = -1;
					end = -1;
				}
			}
		}
	}
}
