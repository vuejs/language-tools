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
		const range = {
			start: position,
			end: position,
		};

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult.length) return htmlResult;

		const cssResult = getCssResult(sourceFile);
		if (cssResult.length) return cssResult;

		const tsResult = getTsResult(sourceFile);
		if (tsResult.length) return tsResult;

		function getTsResult(sourceFile: SourceFile) {
			const result: DocumentHighlight[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsLoc of sourceMap.sourceToTargets(range)) {
					if (!tsLoc.data.capabilities.basic) continue;
					const highlights = tsLanguageService.findDocumentHighlights(sourceMap.targetDocument.uri, tsLoc.range.start);
					for (const highlight of highlights) {
						const vueLoc = sourceMap.targetToSource(highlight.range);
						if (vueLoc) {
							result.push({
								...highlight,
								range: vueLoc.range,
							});
						}
					}
				}
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: DocumentHighlight[] = [];
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				for (const htmlLoc of sourceMap.sourceToTargets(range)) {
					const highlights = languageServices.html.findDocumentHighlights(sourceMap.targetDocument, htmlLoc.range.start, sourceMap.htmlDocument);
					for (const highlight of highlights) {
						const vueLoc = sourceMap.targetToSource(highlight.range);
						if (vueLoc) {
							result.push({
								...highlight,
								range: vueLoc.range,
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
				if (!cssLanguageService) continue;
				for (const cssLoc of sourceMap.sourceToTargets(range)) {
					const highlights = cssLanguageService.findDocumentHighlights(sourceMap.targetDocument, cssLoc.range.start, sourceMap.stylesheet);
					for (const highlight of highlights) {
						const vueLoc = sourceMap.targetToSource(highlight.range);
						if (vueLoc) {
							result.push({
								...highlight,
								range: vueLoc.range,
							});
						}
					}
				}
			}
			return result;
		}
	}
}
