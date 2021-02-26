import type { TsApiRegisterOptions } from '../types';
import {
	Position,
	DocumentHighlight,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFile';
import * as languageServices from '../utils/languageServices';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {
	return (document: TextDocument, position: Position) => {
		const sourceFile = sourceFiles.get(document.uri);
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
				for (const tsRange of sourceMap.sourceToTargets(position)) {
					if (!tsRange.data.capabilities.basic) continue;
					const highlights = tsLanguageService.findDocumentHighlights(sourceMap.targetDocument.uri, tsRange.start);
					for (const highlight of highlights) {
						const vueRange = sourceMap.targetToSource(highlight.range.start, highlight.range.end);
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
				for (const htmlRange of sourceMap.sourceToTargets(position)) {

					const highlights = sourceMap.language === 'html'
						? languageServices.html.findDocumentHighlights(sourceMap.targetDocument, htmlRange.start, sourceMap.htmlDocument)
						: languageServices.pug.findDocumentHighlights(sourceMap.pugDocument, htmlRange.start)
					if (!highlights) continue;

					for (const highlight of highlights) {
						const vueRange = sourceMap.targetToSource(highlight.range.start, highlight.range.end);
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
				const cssLanguageService = languageServices.getCssLanguageService(sourceMap.targetDocument.languageId);
				if (!cssLanguageService || !sourceMap.stylesheet) continue;
				for (const cssRange of sourceMap.sourceToTargets(position)) {
					const highlights = cssLanguageService.findDocumentHighlights(sourceMap.targetDocument, cssRange.start, sourceMap.stylesheet);
					for (const highlight of highlights) {
						const vueRange = sourceMap.targetToSource(highlight.range.start, highlight.range.end);
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
