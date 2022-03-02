import * as vscode from 'vscode-languageserver-protocol';
import type { SourceFile } from '@volar/vue-typescript';
import type { LanguageServiceRuntimeContext } from '../types';

export function register({ documentContext, sourceFiles, htmlLs, pugLs, getCssLs, getStylesheet, getPugDocument }: LanguageServiceRuntimeContext) {
	return async (uri: string) => {
		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const document = sourceFile.getTextDocument();
		const tsResult2 = getTsResult2(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = await getCssResult(sourceFile);

		return [
			...cssResult,
			...htmlResult,
			...tsResult2,
		];

		function getTsResult2(sourceFile: SourceFile) {
			const result: vscode.DocumentLink[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {

				for (const maped of sourceMap.mappings) {

					if (!maped.data.capabilities.displayWithLink)
						continue;

					result.push({
						range: {
							start: document.positionAt(maped.sourceRange.start),
							end: document.positionAt(maped.sourceRange.end),
						},
						target: uri, // TODO
					});
				}
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: vscode.DocumentLink[] = [];
			for (const sourceMap of sourceFile.getTemplateSourceMaps()) {

				const pugDocument = getPugDocument(sourceMap.mappedDocument);
				const links =
					sourceMap.mappedDocument.languageId === 'html' ? htmlLs.findDocumentLinks(sourceMap.mappedDocument, documentContext)
						: pugDocument ? pugLs.findDocumentLinks(pugDocument, documentContext)
							: [];

				for (const link of links) {
					const vueRange = sourceMap.getSourceRange(link.range.start, link.range.end)?.[0];
					if (vueRange) {
						result.push({
							...link,
							range: vueRange,
						});
					}
				}
			}
			return result;
		}
		async function getCssResult(sourceFile: SourceFile) {
			const sourceMaps = sourceFile.getCssSourceMaps();
			const result: vscode.DocumentLink[] = [];
			for (const sourceMap of sourceMaps) {

				const stylesheet = getStylesheet(sourceMap.mappedDocument);
				const cssLs = getCssLs(sourceMap.mappedDocument.languageId);

				if (!cssLs || !stylesheet)
					continue;

				const links = await cssLs.findDocumentLinks2(sourceMap.mappedDocument, stylesheet, documentContext);
				for (const link of links) {
					const vueRange = sourceMap.getSourceRange(link.range.start, link.range.end)?.[0];
					if (vueRange) {
						result.push({
							...link,
							range: vueRange,
						});
					}
				}
			}
			return result;
		}
	}
}
