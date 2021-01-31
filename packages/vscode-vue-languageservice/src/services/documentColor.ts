import type { TsApiRegisterOptions } from '../types';
import {
	ColorInformation,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFile';
import * as languageServices from '../utils/languageServices';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ sourceFiles }: TsApiRegisterOptions) {
	return (document: TextDocument) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const cssResult = getCssResult(sourceFile);
		return cssResult;

		function getCssResult(sourceFile: SourceFile) {
			const result: ColorInformation[] = [];
			const sourceMaps = sourceFile.getCssSourceMaps();
			for (const sourceMap of sourceMaps) {
				const cssLanguageService = languageServices.getCssLanguageService(sourceMap.targetDocument.languageId);
				if (!cssLanguageService) continue;
				let colors = cssLanguageService.findDocumentColors(sourceMap.targetDocument, sourceMap.stylesheet);
				for (const color of colors) {
					const vueLoc = sourceMap.targetToSource(color.range);
					if (vueLoc) {
						result.push({
							...color,
							range: vueLoc.range,
						});
					}
				}
			}
			return result;
		}
	}
}
