import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import { createSourceFile } from '../sourceFile';
import type { HtmlLanguageServiceContext } from '../types';

export function register(context: HtmlLanguageServiceContext) {

	const { getCssLs } = context;

	return (document: TextDocument) => {

		const sourceFile = createSourceFile(document, context);

		const cssResult = getCssResult(sourceFile);
		return cssResult;

		function getCssResult(sourceFile: SourceFile) {
			const result: vscode.ColorInformation[] = [];
			const sourceMaps = sourceFile.getCssSourceMaps();
			for (const sourceMap of sourceMaps) {
				const cssLs = getCssLs(sourceMap.mappedDocument.languageId);
				if (!cssLs || !sourceMap.stylesheet) continue;
				let colors = cssLs.findDocumentColors(sourceMap.mappedDocument, sourceMap.stylesheet);
				for (const color of colors) {
					const vueRange = sourceMap.getSourceRange(color.range.start, color.range.end);
					if (vueRange) {
						result.push({
							...color,
							range: vueRange,
						});
					}
				}
			}
			return result;
		}
	}
}
