import {
	TextDocument,
	ColorInformation,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';

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
				let colors = sourceMap.languageService.findDocumentColors(sourceMap.targetDocument, sourceMap.stylesheet);
				for (const color of colors) {
					const vueLoc = sourceMap.findSource(color.range);
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
