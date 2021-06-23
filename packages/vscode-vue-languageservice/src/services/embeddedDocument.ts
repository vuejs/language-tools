import type { ApiLanguageServiceContext } from '../types';
import type { Range } from 'vscode-languageserver/node';
import type { SourceFile } from '../sourceFile';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceMap } from '../utils/sourceMaps';

export function register({ sourceFiles }: ApiLanguageServiceContext) {
	return (uri: string, range: Range): {
		language: string,
		document: TextDocument | undefined,
		range: Range,
		sourceMap: SourceMap | undefined,
	} | undefined => {
		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const tsResult = getTsResult(sourceFile);
		if (tsResult !== undefined) return tsResult;

		// precede html for support inline css service
		const cssResult = getCssResult(sourceFile);
		if (cssResult !== undefined) return cssResult;

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult !== undefined) return htmlResult;

		const pugResult = getPugResult(sourceFile);
		if (pugResult !== undefined) return pugResult;

		return {
			language: 'vue',
			document: undefined,
			sourceMap: undefined,
			range,
		};

		function getTsResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				const tsRanges = sourceMap.getMappedRanges(range.start, range.end);
				for (const tsRange of tsRanges) {
					return {
						sourceMap,
						language: sourceMap.mappedDocument.languageId,
						document: sourceMap.mappedDocument,
						range: tsRange,
					};
				}
			}
		}
		function getHtmlResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				const htmlRanges = sourceMap.getMappedRanges(range.start, range.end);
				for (const htmlRange of htmlRanges) {
					return {
						sourceMap,
						language: sourceMap.mappedDocument.languageId,
						document: sourceMap.mappedDocument,
						range: htmlRange,
					};
				}
			}
		}
		function getPugResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getPugSourceMaps()) {
				const pugRanges = sourceMap.getMappedRanges(range.start, range.end);
				for (const pugRange of pugRanges) {
					return {
						sourceMap,
						language: sourceMap.mappedDocument.languageId,
						document: sourceMap.mappedDocument,
						range: pugRange,
					};
				}
			}
		}
		function getCssResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssRanges = sourceMap.getMappedRanges(range.start, range.end);
				for (const cssRange of cssRanges) {
					return {
						sourceMap,
						language: sourceMap.mappedDocument.languageId,
						document: sourceMap.mappedDocument,
						range: cssRange,
					};
				}
			}
		}
	}
}
