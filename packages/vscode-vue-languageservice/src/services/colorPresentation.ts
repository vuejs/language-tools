import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import type { HtmlLanguageServiceContext } from '../types';

export function register(context: HtmlLanguageServiceContext) {

	const { getCssLs } = context;

	return (document: TextDocument, color: vscode.Color, range: vscode.Range) => {

		const sourceFile = context.getVueDocument(document);
		if (!sourceFile)
			return;

		const cssResult = getCssResult(sourceFile);

		return cssResult;

		function getCssResult(sourceFile: SourceFile) {
			let result: vscode.ColorPresentation[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssLs = getCssLs(sourceMap.mappedDocument.languageId);
				if (!cssLs || !sourceMap.stylesheet) continue;
				const cssRanges = sourceMap.getMappedRanges(range.start, range.end);
				for (const [cssRange] of cssRanges) {
					const _result = cssLs.getColorPresentations(sourceMap.mappedDocument, sourceMap.stylesheet, color, cssRange);
					for (const item of _result) {
						if (item.textEdit) {
							if (vscode.TextEdit.is(item.textEdit)) {
								const vueRange = sourceMap.getSourceRange(item.textEdit.range.start, item.textEdit.range.end)?.[0];
								if (vueRange) {
									item.textEdit.range = vueRange;
								}
							}
							if (item.additionalTextEdits) {
								for (const textEdit of item.additionalTextEdits) {
									const vueRange = sourceMap.getSourceRange(item.textEdit.range.start, item.textEdit.range.end)?.[0];
									if (vueRange) {
										textEdit.range = vueRange;
									}
								}
							}
						}
					}
					result = result.concat(_result);
				}
			}
			return result;
		}
	}
}
