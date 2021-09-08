import type * as vscode from 'vscode-languageserver';
import type { SourceFile } from '../sourceFile';
import type { ApiLanguageServiceContext } from '../types';

export function register({ sourceFiles, getTsLs, htmlLs, pugLs, getCssLs }: ApiLanguageServiceContext) {
	return (uri: string, position: vscode.Position) => {

		const sourceFile = sourceFiles.get(uri);

		const htmlResult = sourceFile ? getHtmlResult(sourceFile) : [];
		if (htmlResult.length) return htmlResult;

		const cssResult = sourceFile ? getCssResult(sourceFile) : [];
		if (cssResult.length) return cssResult;

		const tsResult = getTsResult();
		if (tsResult.length) return tsResult;

		function getTsResult() {
			const result: vscode.DocumentHighlight[] = [];
			for (const tsLoc of sourceFiles.toTsLocations(uri, position)) {

				if (tsLoc.type === 'embedded-ts' && !tsLoc.range.data.capabilities.basic)
					continue;

				if (tsLoc.type === 'source-ts' && tsLoc.lsType !== 'script')
					continue;

				const highlights = getTsLs(tsLoc.lsType).findDocumentHighlights(tsLoc.uri, tsLoc.range.start);
				for (const highlight of highlights) {
					for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc.uri, highlight.range.start, highlight.range.end)) {
						result.push({
							...highlight,
							range: vueLoc.range,
						});
					}
				}
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: vscode.DocumentHighlight[] = [];
			for (const sourceMap of [...sourceFile.getHtmlSourceMaps(), ...sourceFile.getPugSourceMaps()]) {
				for (const htmlRange of sourceMap.getMappedRanges(position)) {

					const highlights = sourceMap.language === 'html'
						? htmlLs.findDocumentHighlights(sourceMap.mappedDocument, htmlRange.start, sourceMap.htmlDocument)
						: pugLs.findDocumentHighlights(sourceMap.pugDocument, htmlRange.start)
					if (!highlights) continue;

					for (const highlight of highlights) {
						const vueRange = sourceMap.getSourceRange(highlight.range.start, highlight.range.end);
						if (vueRange) {
							result.push({
								...highlight,
								range: vueRange,
							});
						}
					}
				}
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			const result: vscode.DocumentHighlight[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssLs = getCssLs(sourceMap.mappedDocument.languageId);
				if (!cssLs || !sourceMap.stylesheet) continue;
				for (const cssRange of sourceMap.getMappedRanges(position)) {
					const highlights = cssLs.findDocumentHighlights(sourceMap.mappedDocument, cssRange.start, sourceMap.stylesheet);
					for (const highlight of highlights) {
						const vueRange = sourceMap.getSourceRange(highlight.range.start, highlight.range.end);
						if (vueRange) {
							result.push({
								...highlight,
								range: vueRange,
							});
						}
					}
				}
			}
			return result;
		}
	}
}
