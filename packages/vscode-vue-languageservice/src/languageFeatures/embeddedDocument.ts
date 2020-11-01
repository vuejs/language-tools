import type { Range } from 'vscode-languageserver';
import type { SourceFile } from '../sourceFiles';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceMap } from '../utils/sourceMaps';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, range: Range): {
		document: TextDocument,
		range: Range,
		sourceMap: SourceMap | undefined,
	} | undefined => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const tsResult = getTsResult(sourceFile);
		if (tsResult !== undefined) return tsResult;

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult !== undefined) return htmlResult;

		const pugResult = getPugResult(sourceFile);
		if (pugResult !== undefined) return pugResult;

		const cssResult = getCssResult(sourceFile);
		if (cssResult !== undefined) return cssResult;

		return {
			sourceMap: undefined,
			document,
			range,
		};

		function getTsResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				const virtualLocs = sourceMap.sourceToTargets(range);
				for (const virtualLoc of virtualLocs) {
					if (!virtualLoc.maped.data.capabilities.formatting) continue;
					return {
						sourceMap,
						document: sourceMap.targetDocument,
						range: virtualLoc.range,
					};
				}
			}
		}
		function getHtmlResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				const virtualLocs = sourceMap.sourceToTargets(range);
				for (const virtualLoc of virtualLocs) {
					return {
						sourceMap,
						document: sourceMap.targetDocument,
						range: virtualLoc.range,
					};
				}
			}
		}
		function getPugResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getPugSourceMaps()) {
				const virtualLocs = sourceMap.sourceToTargets(range);
				for (const virtualLoc of virtualLocs) {
					return {
						sourceMap,
						document: sourceMap.targetDocument,
						range: virtualLoc.range,
					};
				}
			}
		}
		function getCssResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const virtualLocs = sourceMap.sourceToTargets(range);
				for (const virtualLoc of virtualLocs) {
					return {
						sourceMap,
						document: sourceMap.targetDocument,
						range: virtualLoc.range,
					};
				}
			}
		}
	}
}
