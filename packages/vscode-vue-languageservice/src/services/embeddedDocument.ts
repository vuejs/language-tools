import type { LanguageServiceRuntimeContext } from '../types';
import type * as vscode from 'vscode-languageserver-protocol';
import type { SourceFile } from '../sourceFile';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceMap } from '@volar/source-map';

export function register({ sourceFiles }: LanguageServiceRuntimeContext) {
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

		const templateResult = getTemplateResult(sourceFile);
		if (templateResult !== undefined) return templateResult;

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
		function getTemplateResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getTemplateSourceMaps()) {
				for (const [htmlOrPugRange] of sourceMap.getMappedRanges(range.start, range.end)) {
					return {
						sourceMap,
						language: sourceMap.mappedDocument.languageId,
						document: sourceMap.mappedDocument,
						range: htmlOrPugRange,
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
