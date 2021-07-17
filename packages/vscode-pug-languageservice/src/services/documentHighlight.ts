import { transformLocations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, pos: vscode.Position) => {

		const htmlRange = pugDoc.sourceMap.getMappedRange(pos);
		if (!htmlRange) return;

		const htmlResult = htmlLs.findDocumentHighlights(
			pugDoc.sourceMap.mappedDocument,
			htmlRange.start,
			pugDoc.htmlDocument,
		);

		return transformLocations(
			htmlResult,
			htmlRange => pugDoc.sourceMap.getSourceRange(htmlRange.start, htmlRange.end),
		);
	}
}
