import type { TsApiRegisterOptions } from '../types';
import {
	Position,
	SelectionRange,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFile';
import * as languageServices from '../utils/languageServices';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {
	return (document: TextDocument, positions: Position[]) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const tsResult = getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = getCssResult(sourceFile);
		return [...cssResult, ...htmlResult, ...tsResult];

		function getTsResult(sourceFile: SourceFile) {
			let result: SelectionRange[] = [];
			for (const position of positions) {
				for (const sourceMap of sourceFile.getTsSourceMaps()) {
					for (const tsRange of sourceMap.sourceToTargets(position)) {
						if (!tsRange.data.capabilities.basic) continue;
						const selectRange = tsLanguageService.getSelectionRange(sourceMap.targetDocument.uri, tsRange.start);
						if (selectRange) {
							const vueRange = sourceMap.targetToSource(selectRange.range.start, selectRange.range.end);
							if (vueRange) {
								result.push({
									range: vueRange,
									// TODO: parent
								});
							}
						}
					}
				}
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			let result: SelectionRange[] = [];
			for (const position of positions) {
				for (const sourceMap of [...sourceFile.getHtmlSourceMaps(), ...sourceFile.getPugSourceMaps()]) {
					for (const htmlRange of sourceMap.sourceToTargets(position)) {
						const selectRanges = sourceMap.language === 'html'
							? languageServices.html.getSelectionRanges(sourceMap.targetDocument, [htmlRange.start])
							: languageServices.pug.getSelectionRanges(sourceMap.pugDocument, [htmlRange.start])
						for (const selectRange of selectRanges) {
							const vueRange = sourceMap.targetToSource(selectRange.range.start, selectRange.range.end);
							if (vueRange) {
								result.push({
									range: vueRange,
									// TODO: parent
								});
							}
						}
					}
				}
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: SelectionRange[] = [];
			for (const position of positions) {
				for (const sourceMap of sourceFile.getCssSourceMaps()) {
					const cssLanguageService = languageServices.getCssLanguageService(sourceMap.targetDocument.languageId);
					if (!cssLanguageService || !sourceMap.stylesheet) continue;
					for (const cssRange of sourceMap.sourceToTargets(position)) {
						const selectRanges = cssLanguageService.getSelectionRanges(sourceMap.targetDocument, [cssRange.start], sourceMap.stylesheet);
						for (const selectRange of selectRanges) {
							const vueRange = sourceMap.targetToSource(selectRange.range.start, selectRange.range.end);
							if (vueRange) {
								result.push({
									range: vueRange,
									// TODO: parent
								});
							}
						}
					}
				}
			}
			return result;
		}
	}
}
