import type { TsApiRegisterOptions } from '../types';
import {
	ColorPresentation,
	Color,
	Range,
	TextEdit,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFile';
import * as languageServices from '../utils/languageServices';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ sourceFiles }: TsApiRegisterOptions) {
	return (document: TextDocument, color: Color, range: Range) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const cssResult = getCssResult(sourceFile);
		return cssResult;

		function getCssResult(sourceFile: SourceFile) {
			let result: ColorPresentation[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssLanguageService = languageServices.getCssLanguageService(sourceMap.mappedDocument.languageId);
				if (!cssLanguageService || !sourceMap.stylesheet) continue;
				const cssRanges = sourceMap.getMappedRanges(range.start, range.end);
				for (const cssRange of cssRanges) {
					const _result = cssLanguageService.getColorPresentations(sourceMap.mappedDocument, sourceMap.stylesheet, color, cssRange);
					for (const item of _result) {
						if (item.textEdit) {
							if (TextEdit.is(item.textEdit)) {
								const vueRange = sourceMap.getSourceRange(item.textEdit.range.start, item.textEdit.range.end);
								if (vueRange) {
									item.textEdit.range = vueRange;
								}
							}
							if (item.additionalTextEdits) {
								for (const textEdit of item.additionalTextEdits) {
									const vueRange = sourceMap.getSourceRange(item.textEdit.range.start, item.textEdit.range.end);
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
