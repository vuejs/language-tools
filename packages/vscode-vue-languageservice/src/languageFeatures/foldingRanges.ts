import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFiles';
import type { SourceMap } from '../utils/sourceMaps';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import * as globalServices from '../globalServices';
import { FoldingRangeKind } from 'vscode-css-languageservice';
import { FoldingRange } from 'vscode-languageserver';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const vueResult = getVueResult(); // include html folding ranges
		const tsResult = getTsResult(sourceFile);
		const cssResult = getCssResult(sourceFile);
		const pugResult = getPugResult(sourceFile);

		return [
			...vueResult,
			...tsResult,
			...cssResult,
			...pugResult,
		];

		function getVueResult() {
			return globalServices.html.getFoldingRanges(document);
		}
		function getTsResult(sourceFile: SourceFile) {
			let result: FoldingRange[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				if (!sourceMap.capabilities.foldingRanges)
					continue;
				const foldingRanges = tsLanguageService.getFoldingRanges(sourceMap.virtualDocument);
				result = result.concat(toVueFoldingRanges(foldingRanges, sourceMap));
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: FoldingRange[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssLanguageService = sourceMap.virtualDocument.languageId === 'scss' ? globalServices.scss : globalServices.css;
				const foldingRanges = cssLanguageService.getFoldingRanges(sourceMap.virtualDocument);
				result = result.concat(toVueFoldingRanges(foldingRanges, sourceMap));
			}
			return result;
		}
		function getPugResult(sourceFile: SourceFile) {
			let result: FoldingRange[] = [];
			for (const sourceMap of sourceFile.getPugSourceMaps()) {
				const text = sourceMap.virtualDocument.getText();
				const lines = text.split('\n');
				const lineOffsets = getLineOffsets(lines);
				const lineIndents = getLineIndents(lines);
				const foldingRanges: FoldingRange[] = [];

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const offset = lineOffsets[i];
					const indent = lineIndents[i];
					if (indent === undefined) continue;
					const startPos = sourceMap.virtualDocument.positionAt(offset);
					const kind = getFoldingRangeKind(line);
					let found = false;

					for (let j = i + 1; j < lines.length; j++) {
						const offset_2 = lineOffsets[j];
						const indent_2 = lineIndents[j];
						if (indent_2 === undefined) continue;
						if (indent_2.length <= indent.length) {
							const endPos = sourceMap.virtualDocument.positionAt(offset_2);
							const foldingRange = FoldingRange.create(
								startPos.line,
								endPos.line - 1,
								undefined,
								undefined,
								kind,
							);
							foldingRanges.push(foldingRange);
							found = true;
							break;
						}
					}

					if (!found) {
						const offset_2 = text.length;
						const endPos = sourceMap.virtualDocument.positionAt(offset_2);
						const foldingRange = FoldingRange.create(
							startPos.line,
							endPos.line - 1,
							undefined,
							undefined,
							kind,
						);
						foldingRanges.push(foldingRange);
					}
				}

				result = result.concat(toVueFoldingRanges(foldingRanges, sourceMap));
			}
			return result;

			function getLineOffsets(lines: string[]) {
				const offsets: number[] = [];
				let currentOffset = 0;
				for (const line of lines) {
					offsets.push(currentOffset);
					currentOffset += line.length + 1;
				}
				return offsets;
			}
			function getLineIndents(lines: string[]) {
				const indents: (string | undefined)[] = [];
				for (const line of lines) {
					const line2 = line.trimStart();
					if (line2 === '') {
						indents.push(undefined);
					}
					else {
						const offset = line.length - line2.length;
						const indent = line.substr(0, offset);
						indents.push(indent);
					}
				}
				return indents;
			}
			function getFoldingRangeKind(line: string) {
				if (line.trimStart().startsWith('//')) {
					return FoldingRangeKind.Comment;
				}
			}
		}
	}
}

function toVueFoldingRanges(virtualFoldingRanges: FoldingRange[], sourceMap: SourceMap) {
	const result: FoldingRange[] = [];
	for (const foldingRange of virtualFoldingRanges) {
		const vueLoc = sourceMap.findFirstVueLocation({
			start: { line: foldingRange.startLine, character: foldingRange.startCharacter ?? 0 },
			end: { line: foldingRange.endLine, character: foldingRange.endCharacter ?? 0 },
		});
		if (vueLoc) {
			foldingRange.startLine = vueLoc.range.start.line;
			foldingRange.endLine = vueLoc.range.end.line;
			if (foldingRange.startCharacter !== undefined)
				foldingRange.startCharacter = vueLoc.range.start.character;
			if (foldingRange.endCharacter !== undefined)
				foldingRange.endCharacter = vueLoc.range.end.character;
			result.push(foldingRange);
		}
	}
	return result;
}
