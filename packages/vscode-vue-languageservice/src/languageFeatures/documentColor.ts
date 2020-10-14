import {
	TextDocument,
	ColorInformation,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import * as globalServices from '../globalServices';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const cssResult = getCssResult(sourceFile);
		return cssResult;

		function getCssResult(sourceFile: SourceFile) {
			const result: ColorInformation[] = [];
			const sourceMaps = sourceFile.getCssSourceMaps();
			for (const sourceMap of sourceMaps) {
				const cssLanguageService = sourceMap.virtualDocument.languageId === 'scss' ? globalServices.scss : globalServices.css;
				let colors = cssLanguageService.findDocumentColors(sourceMap.virtualDocument, sourceMap.stylesheet);
				for (const color of colors) {
					const vueLoc = sourceMap.findFirstVueLocation(color.range);
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
