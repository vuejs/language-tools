import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import type { DocumentServiceRuntimeContext } from '../types';

export function register(context: DocumentServiceRuntimeContext) {

	const { getCssLs, getStylesheet } = context;

	return (document: TextDocument) => {

		const sourceFile = context.getVueDocument(document);
		if (!sourceFile)
			return;

		const cssResult = getCssResult(sourceFile);

		return cssResult;

		function getCssResult(sourceFile: SourceFile) {
			const result: vscode.ColorInformation[] = [];
			const sourceMaps = sourceFile.getCssSourceMaps();
			for (const sourceMap of sourceMaps) {

				const stylesheet = getStylesheet(sourceMap.mappedDocument);
				const cssLs = getCssLs(sourceMap.mappedDocument.languageId);

				if (!cssLs || !stylesheet)
					continue;

				let colors = cssLs.findDocumentColors(sourceMap.mappedDocument, stylesheet);
				for (const color of colors) {
					const vueRange = sourceMap.getSourceRange(color.range.start, color.range.end)?.[0];
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
