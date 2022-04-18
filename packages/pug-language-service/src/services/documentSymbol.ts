import { transformSymbolInformations } from '@volar/transforms';
import type * as html from 'vscode-html-languageservice';
import type { PugDocument } from '../pugDocument';
import * as vscode from 'vscode-languageserver-types';

export function register(htmlLs: html.LanguageService) {
	return (pugDoc: PugDocument) => {

		const htmlResult = htmlLs.findDocumentSymbols(
			pugDoc.sourceMap.mappedDocument,
			pugDoc.htmlDocument,
		);

		return transformSymbolInformations(
			htmlResult,
			htmlLocation => {
				const pugRange = pugDoc.sourceMap.getSourceRange(htmlLocation.range.start, htmlLocation.range.end)?.[0];
				return pugRange ? vscode.Location.create(pugDoc.sourceMap.sourceDocument.uri, pugRange) : undefined;
			},
		);
	};
}
