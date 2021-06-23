import type {
	Position,
	SelectionRange
} from 'vscode-languageserver/node';
import type { SourceFile } from '../sourceFile';
import type { ApiLanguageServiceContext } from '../types';

export function register({ sourceFiles, tsLs, htmlLs, pugLs, getCssLs }: ApiLanguageServiceContext) {
	return (uri: string, positions: Position[]) => {
		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const tsResult = getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = getCssResult(sourceFile);
		return [...cssResult, ...htmlResult, ...tsResult];

		function getTsResult(sourceFile: SourceFile) {
			let result: SelectionRange[] = [];
			for (const position of positions) {
				for (const sourceMap of sourceFile.getTsSourceMaps()) {
					for (const tsRange of sourceMap.getMappedRanges(position)) {
						if (!tsRange.data.capabilities.basic) continue;
						const selectRange = tsLs.getSelectionRange(sourceMap.mappedDocument.uri, tsRange.start);
						if (selectRange) {
							const vueRange = sourceMap.getSourceRange(selectRange.range.start, selectRange.range.end);
							if (vueRange) {
								result.push({
									range: vueRange,
									// TODO: parent
								});
							}
						}
					}
				}
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			let result: SelectionRange[] = [];
			for (const position of positions) {
				for (const sourceMap of [...sourceFile.getHtmlSourceMaps(), ...sourceFile.getPugSourceMaps()]) {
					for (const htmlRange of sourceMap.getMappedRanges(position)) {
						const selectRanges = sourceMap.language === 'html'
							? htmlLs.getSelectionRanges(sourceMap.mappedDocument, [htmlRange.start])
							: pugLs.getSelectionRanges(sourceMap.pugDocument, [htmlRange.start])
						for (const selectRange of selectRanges) {
							const vueRange = sourceMap.getSourceRange(selectRange.range.start, selectRange.range.end);
							if (vueRange) {
								result.push({
									range: vueRange,
									// TODO: parent
								});
							}
						}
					}
				}
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: SelectionRange[] = [];
			for (const position of positions) {
				for (const sourceMap of sourceFile.getCssSourceMaps()) {
					const cssLs = getCssLs(sourceMap.mappedDocument.languageId);
					if (!cssLs || !sourceMap.stylesheet) continue;
					for (const cssRange of sourceMap.getMappedRanges(position)) {
						const selectRanges = cssLs.getSelectionRanges(sourceMap.mappedDocument, [cssRange.start], sourceMap.stylesheet);
						for (const selectRange of selectRanges) {
							const vueRange = sourceMap.getSourceRange(selectRange.range.start, selectRange.range.end);
							if (vueRange) {
								result.push({
									range: vueRange,
									// TODO: parent
								});
							}
						}
					}
				}
			}
			return result;
		}
	}
}
