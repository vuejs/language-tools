import type { ApiLanguageServiceContext } from '../types';
import type * as vscode from 'vscode-languageserver-protocol';
import type { SourceFile } from '../sourceFile';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceMap } from '@volar/source-map';

export function register({ sourceFiles }: ApiLanguageServiceContext) {
	return (uri: string, range: vscode.Range): {
		language: string,
		document: TextDocument | undefined,
		range: vscode.Range,
		sourceMap: SourceMap<any> | undefined,
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
				for (const [tsRange] of sourceMap.getMappedRanges(range.start, range.end)) {
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
				for (const [htmlRange] of sourceMap.getMappedRanges(range.start, range.end)) {
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
				for (const [pugRange] of sourceMap.getMappedRanges(range.start, range.end)) {
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
				for (const [cssRange] of sourceMap.getMappedRanges(range.start, range.end)) {
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
