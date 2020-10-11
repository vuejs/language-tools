import {
	Position,
	TextDocument,
	Hover,
	MarkupContent,
	MarkedString,
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
		if (!tsResult && !htmlResult && !cssResult) return;

		const texts: MarkedString[] = [
			...getHoverTexts(tsResult),
			...getHoverTexts(htmlResult),
			...getHoverTexts(cssResult),
		];
		const result: Hover = {
			contents: texts,
			range: tsResult?.range ?? htmlResult?.range ?? cssResult?.range,
		};

		return result;

		function getHoverTexts(hover?: Hover) {
			if (!hover) return [];
			if (typeof hover.contents === 'string') {
				return [hover.contents];
			}
			if (MarkupContent.is(hover.contents)) {
				return [hover.contents.value];
			}
			if (Array.isArray(hover.contents)) {
				return hover.contents;
			}
			return [hover.contents.value];
		}
		function getTsResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsLoc of sourceMap.findVirtualLocations(range)) {
					if (!tsLoc.maped.data.capabilities.basic) continue;
					const result = sourceMap.languageService.doHover(sourceMap.virtualDocument, tsLoc.range.start);
					if (result?.range) {
						const vueLoc = sourceMap.findFirstVueLocation(result.range);
						if (vueLoc) result.range = vueLoc.range;
					}
					if (result) {
						return result;
					}
				}
			}
		}
		function getHtmlResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				for (const htmlLoc of sourceMap.findVirtualLocations(range)) {
					const result = sourceMap.languageService.doHover(sourceMap.virtualDocument, htmlLoc.range.start, sourceMap.htmlDocument);
					if (result?.range) {
						const vueLoc = sourceMap.findFirstVueLocation(result.range);
						if (vueLoc) result.range = vueLoc.range;
					}
					if (result) {
						return result
					}
				}
			}
		}
		function getCssResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				for (const cssLoc of sourceMap.findVirtualLocations(range)) {
					const result = sourceMap.languageService.doHover(sourceMap.virtualDocument, cssLoc.range.start, sourceMap.stylesheet);
					if (result?.range) {
						const vueLoc = sourceMap.findFirstVueLocation(result.range);
						if (vueLoc) result.range = vueLoc.range;
					}
					if (result) {
						return result
					}
				}
			}
		}
	}
}
