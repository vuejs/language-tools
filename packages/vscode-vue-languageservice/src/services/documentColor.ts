import type { ColorInformation } from 'vscode-languageserver/node';
import type { SourceFile } from '../sourceFile';
import type { TsApiRegisterOptions } from '../types';
import * as languageServices from '../utils/languageServices';

export function register({ sourceFiles }: TsApiRegisterOptions) {
	return (uri: string) => {
		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const cssResult = getCssResult(sourceFile);
		return cssResult;

		function getCssResult(sourceFile: SourceFile) {
			const result: ColorInformation[] = [];
			const sourceMaps = sourceFile.getCssSourceMaps();
			for (const sourceMap of sourceMaps) {
				const cssLanguageService = languageServices.getCssLanguageService(sourceMap.mappedDocument.languageId);
				if (!cssLanguageService || !sourceMap.stylesheet) continue;
				let colors = cssLanguageService.findDocumentColors(sourceMap.mappedDocument, sourceMap.stylesheet);
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
