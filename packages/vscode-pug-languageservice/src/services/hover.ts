import { transformHover } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (docDoc: PugDocument, pos: vscode.Position) => {

		const htmlRange = docDoc.sourceMap.getMappedRange(pos, pos, data => !data?.isEmptyTagCompletion)?.[0];
		if (!htmlRange) return;

		const htmlResult = htmlLs.doHover(
			docDoc.sourceMap.mappedDocument,
			htmlRange.start,
			docDoc.htmlDocument,
			// {references: false}
		);
		if (!htmlResult) return;

		return transformHover(
			htmlResult,
			htmlRange => docDoc.sourceMap.getSourceRange(htmlRange.start, htmlRange.end)?.[0],
		);
	}
}
