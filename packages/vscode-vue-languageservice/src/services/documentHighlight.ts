import type { DocumentHighlight, Position } from 'vscode-languageserver/node';
import type { SourceFile } from '../sourceFile';
import type { TsApiRegisterOptions } from '../types';
import * as languageServices from '../utils/languageServices';

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {
	return (uri: string, position: Position) => {
		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult.length) return htmlResult;

		const cssResult = getCssResult(sourceFile);
		if (cssResult.length) return cssResult;

		const tsResult = getTsResult(sourceFile);
		if (tsResult.length) return tsResult;

		function getTsResult(sourceFile: SourceFile) {
			const result: DocumentHighlight[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsRange of sourceMap.getMappedRanges(position)) {
					if (!tsRange.data.capabilities.basic) continue;
					const highlights = tsLanguageService.findDocumentHighlights(sourceMap.mappedDocument.uri, tsRange.start);
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
		function getHtmlResult(sourceFile: SourceFile) {
			const result: DocumentHighlight[] = [];
			for (const sourceMap of [...sourceFile.getHtmlSourceMaps(), ...sourceFile.getPugSourceMaps()]) {
				for (const htmlRange of sourceMap.getMappedRanges(position)) {

					const highlights = sourceMap.language === 'html'
						? languageServices.html.findDocumentHighlights(sourceMap.mappedDocument, htmlRange.start, sourceMap.htmlDocument)
						: languageServices.pug.findDocumentHighlights(sourceMap.pugDocument, htmlRange.start)
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
			const result: DocumentHighlight[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssLanguageService = languageServices.getCssLanguageService(sourceMap.mappedDocument.languageId);
				if (!cssLanguageService || !sourceMap.stylesheet) continue;
				for (const cssRange of sourceMap.getMappedRanges(position)) {
					const highlights = cssLanguageService.findDocumentHighlights(sourceMap.mappedDocument, cssRange.start, sourceMap.stylesheet);
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
