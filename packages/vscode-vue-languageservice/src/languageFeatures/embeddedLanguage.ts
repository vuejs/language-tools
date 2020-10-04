import type { Range } from 'vscode-languageserver';
import type { SourceFile } from '../sourceFiles';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, range: Range): {
		id: string,
		range: Range,
	} | undefined => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const tsResult = getTsResult(sourceFile);
		if (tsResult !== undefined) return tsResult;

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult !== undefined) return htmlResult;

		const cssResult = getCssResult(sourceFile);
		if (cssResult !== undefined) return cssResult;

		const vueDoc = sourceFile.getTextDocument();
		return {
			id: 'vue',
			range: {
				start: vueDoc.positionAt(0),
				end: vueDoc.positionAt(vueDoc.getText().length),
			},
		};

		function getTsResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				const virtualLocs = sourceMap.findVirtualLocations(range);
				for (const virtualLoc of virtualLocs) {
					if (!virtualLoc.data.capabilities.formatting) continue;
					return {
						id: sourceMap.virtualDocument.languageId,
						range: virtualLoc.mapedFromRange,
					};
				}
			}
		}
		function getHtmlResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				const virtualLocs = sourceMap.findVirtualLocations(range);
				for (const virtualLoc of virtualLocs) {
					return {
						id: sourceMap.virtualDocument.languageId,
						range: virtualLoc.mapedFromRange,
					};
				}
			}
		}
		function getCssResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const virtualLocs = sourceMap.findVirtualLocations(range);
				for (const virtualLoc of virtualLocs) {
					return {
						id: sourceMap.virtualDocument.languageId,
						range: virtualLoc.mapedFromRange,
					};
				}
			}
		}
	}
}
