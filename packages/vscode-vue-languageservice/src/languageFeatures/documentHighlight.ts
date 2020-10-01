import {
	Position,
	TextDocument,
	DocumentHighlight,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, position: Position) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = {
			start: position,
			end: position,
		};

		const tsResult = getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = getCssResult(sourceFile);
		return [...cssResult, ...htmlResult, ...tsResult];

		function getTsResult(sourceFile: SourceFile) {
			const result: DocumentHighlight[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsLoc of sourceMap.findTargets(range)) {
					if (!tsLoc.data.capabilities.basic) continue;
					const highlights = sourceMap.languageService.findDocumentHighlights(sourceMap.targetDocument, tsLoc.range.start);
					for (const highlight of highlights) {
						const vueLoc = sourceMap.findSource(highlight.range);
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
				for (const htmlLoc of sourceMap.findTargets(range)) {
					const highlights = sourceMap.languageService.findDocumentHighlights(sourceMap.targetDocument, htmlLoc.range.start, sourceMap.htmlDocument);
					for (const highlight of highlights) {
						const vueLoc = sourceMap.findSource(highlight.range);
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
				for (const cssLoc of sourceMap.findTargets(range)) {
					const highlights = sourceMap.languageService.findDocumentHighlights(sourceMap.targetDocument, cssLoc.range.start, sourceMap.stylesheet);
					for (const highlight of highlights) {
						const vueLoc = sourceMap.findSource(highlight.range);
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
