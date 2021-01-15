import {
	Position,
	TextDocument,
	Hover,
	MarkupContent,
	MarkedString,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import * as globalServices from '../globalServices';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument, position: Position) => {

		if (document.languageId !== 'vue') {
			return tsLanguageService.doHover(document.uri, position);
		}

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
			let _result: Hover | undefined;
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsLoc of sourceMap.sourceToTargets(range)) {
					if (!tsLoc.maped.data.capabilities.basic) continue;
					const result = tsLanguageService.doHover(sourceMap.targetDocument.uri, tsLoc.range.start);
					if (result?.range) {
						const vueLoc = sourceMap.targetToSource(result.range);
						if (vueLoc) result.range = vueLoc.range;
					}
					if (!_result) {
						_result = result;
					}
					else if (_result && result) {
						if (MarkupContent.is(_result.contents) && MarkupContent.is(result.contents)) {
							_result.contents.value += '\n\n' + result.contents.value;
						}
					}
				}
			}
			return _result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				for (const htmlLoc of sourceMap.sourceToTargets(range)) {
					const result = globalServices.html.doHover(sourceMap.targetDocument, htmlLoc.range.start, sourceMap.htmlDocument);
					if (result?.range) {
						const vueLoc = sourceMap.targetToSource(result.range);
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
				const cssLanguageService = globalServices.getCssService(sourceMap.targetDocument.languageId);
				for (const cssLoc of sourceMap.sourceToTargets(range)) {
					const result = cssLanguageService.doHover(sourceMap.targetDocument, cssLoc.range.start, sourceMap.stylesheet);
					if (result?.range) {
						const vueLoc = sourceMap.targetToSource(result.range);
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
