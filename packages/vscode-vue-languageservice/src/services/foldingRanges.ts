import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFiles';
import type { SourceMap, TsSourceMap } from '../utils/sourceMaps';
import * as globalServices from '../globalServices';
import { FoldingRangeKind } from 'vscode-css-languageservice';
import { FoldingRange } from 'vscode-languageserver/node';
import { createSourceFile } from '../sourceFiles';
import { getCheapTsService2 } from '../globalServices';
import { notEmpty } from '@volar/shared';

export function register() {
	return (_document: TextDocument) => {
		const tsService2 = getCheapTsService2(_document);
		let document = TextDocument.create(tsService2.uri, _document.languageId, _document.version, _document.getText());

		const sourceFile = createSourceFile(document, tsService2.service);

		const vueResult = getVueResult(sourceFile); // include html folding ranges
		const tsResult = getTsResult(sourceFile);
		const cssResult = getCssResult(sourceFile);
		const pugResult = getPugResult(sourceFile);

		return [
			...vueResult,
			...tsResult,
			...cssResult,
			...pugResult,
		];

		function getVueResult(sourceFile: SourceFile) {
			let docTextWithoutBlocks = document.getText();
			const desc = sourceFile.getDescriptor();
			const blocks = [desc.script, desc.scriptSetup, ...desc.styles, ...desc.customBlocks].filter(notEmpty);
			if (desc.template && desc.template.lang !== 'html') {
				blocks.push(desc.template);
			}
			for (const block of blocks) {
				const content = docTextWithoutBlocks.substring(block.loc.start, block.loc.end);
				docTextWithoutBlocks = docTextWithoutBlocks.substring(0, block.loc.start)
					+ content.split('\n').map(line => ' '.repeat(line.length)).join('\n')
					+ docTextWithoutBlocks.substring(block.loc.end);
			}
			return globalServices.html.getFoldingRanges(TextDocument.create(document.uri, document.languageId, document.version, docTextWithoutBlocks));
		}
		function getTsResult(sourceFile: SourceFile) {
			const tsSourceMaps = [
				...sourceFile.getTsSourceMaps(),
				sourceFile.getTemplateScriptFormat().sourceMap,
				...sourceFile.getScriptsRaw().sourceMaps,
			].filter(notEmpty);

			let result: FoldingRange[] = [];
			for (const sourceMap of tsSourceMaps) {
				if (!sourceMap.capabilities.foldingRanges)
					continue;
				const cheapTs = getCheapTsService2(sourceMap.targetDocument);
				const foldingRanges = cheapTs.service.getFoldingRanges(cheapTs.uri);
				result = result.concat(toVueFoldingRangesTs(foldingRanges, sourceMap));
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: FoldingRange[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				if (!sourceMap.capabilities.foldingRanges) continue;
				const cssLanguageService = globalServices.getCssService(sourceMap.targetDocument.languageId);
				if (!cssLanguageService) continue;
				const foldingRanges = cssLanguageService.getFoldingRanges(sourceMap.targetDocument);
				result = result.concat(toVueFoldingRanges(foldingRanges, sourceMap));
			}
			return result;
		}
		function getPugResult(sourceFile: SourceFile) {
			let result: FoldingRange[] = [];
			for (const sourceMap of sourceFile.getPugSourceMaps()) {
				const text = sourceMap.targetDocument.getText();
				const lines = text.split('\n');
				const lineOffsets = getLineOffsets(lines);
				const lineIndents = getLineIndents(lines);
				const foldingRanges: FoldingRange[] = [];

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const offset = lineOffsets[i];
					const indent = lineIndents[i];
					if (indent === undefined) continue;
					const startPos = sourceMap.targetDocument.positionAt(offset);
					const kind = getFoldingRangeKind(line);
					let found = false;

					for (let j = i + 1; j < lines.length; j++) {
						const offset_2 = lineOffsets[j];
						const indent_2 = lineIndents[j];
						if (indent_2 === undefined) continue;
						if (indent_2.length <= indent.length) {
							const endPos = sourceMap.targetDocument.positionAt(offset_2);
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
						const endPos = sourceMap.targetDocument.positionAt(offset_2);
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
		const vueLoc = sourceMap.targetToSource({
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
function toVueFoldingRangesTs(virtualFoldingRanges: FoldingRange[], sourceMap: TsSourceMap) {
	const result: FoldingRange[] = [];
	for (const foldingRange of virtualFoldingRanges) {
		const vueLoc = sourceMap.targetToSource({
			start: { line: foldingRange.startLine, character: foldingRange.startCharacter ?? 0 },
			end: { line: foldingRange.endLine, character: foldingRange.endCharacter ?? 0 },
		});
		if (vueLoc && vueLoc.maped.data.capabilities.foldingRanges) {
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
