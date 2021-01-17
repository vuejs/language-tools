import {
	Position,
	TextDocument,
	DocumentHighlight,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import * as globalServices from '../globalServices';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
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
					if (!tsLoc.maped.data.capabilities.basic) continue;
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
					const highlights = globalServices.html.findDocumentHighlights(sourceMap.targetDocument, htmlLoc.range.start, sourceMap.htmlDocument);
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
				const cssLanguageService = globalServices.getCssService(sourceMap.targetDocument.languageId);
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
