import * as shared from '@volar/shared';
import { transformLocations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver';
import type { PugDocument } from '../pugDocument';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument, posArr: vscode.Position[]): vscode.SelectionRange[] => {

		const htmlPosArr = posArr
			.map(position => pugDoc.sourceMap.getMappedRange(position)?.start)
			.filter(shared.notEmpty);

		const htmlResult = htmlLs.getSelectionRanges(
			pugDoc.sourceMap.mappedDocument,
			htmlPosArr,
		);

		return transformLocations(
			htmlResult,
			htmlRange => pugDoc.sourceMap.getSourceRange(htmlRange.start, htmlRange.end),
		);
	}
}
