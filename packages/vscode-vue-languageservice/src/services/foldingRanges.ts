import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import type { SourceMap, TsSourceMap } from '../utils/sourceMaps';
import { FoldingRangeKind } from 'vscode-css-languageservice';
import * as vscode from 'vscode-languageserver';
import { getDummyTsLs } from '../utils/sharedLs';
import * as shared from '@volar/shared';
import type { HtmlLanguageServiceContext } from '../types';
import type { LanguageServiceHost } from 'vscode-typescript-languageservice';

export function register(
	context: HtmlLanguageServiceContext,
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
) {
	const { htmlLs, getCssLs, modules } = context;
	return (document: TextDocument) => {

		const sourceFile = context.getVueDocument(document);
		if (!sourceFile) {
			// take over mode
			const dummyTsLs = getDummyTsLs(modules.typescript, modules.ts, document, getPreferences, getFormatOptions);
			return dummyTsLs.getFoldingRanges(document.uri);
		}

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
			const blocks = [desc.script, desc.scriptSetup, ...desc.styles, ...desc.customBlocks].filter(shared.notEmpty);
			if (desc.template && desc.template.lang !== 'html') {
				blocks.push(desc.template);
			}
			for (const block of blocks) {
				const content = docTextWithoutBlocks.substring(block.startTagEnd, block.startTagEnd + block.content.length);
				docTextWithoutBlocks = docTextWithoutBlocks.substring(0, block.startTagEnd)
					+ content.split('\n').map(line => ' '.repeat(line.length)).join('\n')
					+ docTextWithoutBlocks.substring(block.startTagEnd + block.content.length);
			}
			return htmlLs.getFoldingRanges(TextDocument.create(document.uri, document.languageId, document.version, docTextWithoutBlocks));
		}
		function getTsResult(sourceFile: SourceFile) {
			const tsSourceMaps = [
				sourceFile.getTemplateFormattingScript().sourceMap,
				...sourceFile.docLsScripts().sourceMaps,
			].filter(shared.notEmpty);

			let result: vscode.FoldingRange[] = [];
			for (const sourceMap of tsSourceMaps) {
				if (!sourceMap.capabilities.foldingRanges)
					continue;
				const dummyTsLs = getDummyTsLs(modules.typescript, modules.ts, sourceMap.mappedDocument, getPreferences, getFormatOptions);
				const foldingRanges = dummyTsLs.getFoldingRanges(sourceMap.mappedDocument.uri);
				result = result.concat(toVueFoldingRangesTs(foldingRanges, sourceMap));
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: vscode.FoldingRange[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				if (!sourceMap.capabilities.foldingRanges) continue;
				const cssLs = getCssLs(sourceMap.mappedDocument.languageId);
				if (!cssLs) continue;
				const foldingRanges = cssLs.getFoldingRanges(sourceMap.mappedDocument);
				result = result.concat(toVueFoldingRanges(foldingRanges, sourceMap));
			}
			return result;
		}
		function getPugResult(sourceFile: SourceFile) {

			let result: vscode.FoldingRange[] = [];

			for (const sourceMap of sourceFile.getPugSourceMaps()) {

				const text = sourceMap.mappedDocument.getText();
				const lines = text.split('\n');
				const lineIndents = getLineIndents(lines);
				const foldingRanges: vscode.FoldingRange[] = [];

				for (let startLine = 0; startLine < lines.length; startLine++) {

					const line = lines[startLine];
					const indent = lineIndents[startLine];

					if (indent === undefined)
						continue; // empty line

					const kind = getFoldingRangeKind(line);

					let endLine = lines.length - 1;

					for (let nextLine = startLine + 1; nextLine < lines.length; nextLine++) {
						const indent_2 = lineIndents[nextLine];
						if (indent_2 !== undefined && indent_2.length <= indent.length) {
							endLine = nextLine;
							break;
						}
					}

					while (endLine > 0 && lineIndents[endLine - 1] === undefined)
						endLine--;

					if (startLine !== endLine - 1) {
						const foldingRange = vscode.FoldingRange.create(
							startLine,
							endLine - 1,
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

function toVueFoldingRanges(virtualFoldingRanges: vscode.FoldingRange[], sourceMap: SourceMap) {
	const result: vscode.FoldingRange[] = [];
	for (const foldingRange of virtualFoldingRanges) {
		const vueRange = sourceMap.getSourceRange(
			{ line: foldingRange.startLine, character: foldingRange.startCharacter ?? 0 },
			{ line: foldingRange.endLine, character: foldingRange.endCharacter ?? 0 },
		);
		if (vueRange) {
			foldingRange.startLine = vueRange.start.line;
			foldingRange.endLine = vueRange.end.line;
			if (foldingRange.startCharacter !== undefined)
				foldingRange.startCharacter = vueRange.start.character;
			if (foldingRange.endCharacter !== undefined)
				foldingRange.endCharacter = vueRange.end.character;
			result.push(foldingRange);
		}
	}
	return result;
}
function toVueFoldingRangesTs(virtualFoldingRanges: vscode.FoldingRange[], sourceMap: TsSourceMap) {
	const result: vscode.FoldingRange[] = [];
	for (const foldingRange of virtualFoldingRanges) {
		const vueLoc = sourceMap.getSourceRange(
			{ line: foldingRange.startLine, character: foldingRange.startCharacter ?? 0 },
			{ line: foldingRange.endLine, character: foldingRange.endCharacter ?? 0 },
		);
		if (vueLoc && vueLoc.data.capabilities.foldingRanges) {
			foldingRange.startLine = vueLoc.start.line;
			foldingRange.endLine = vueLoc.end.line;
			if (foldingRange.startCharacter !== undefined)
				foldingRange.startCharacter = vueLoc.start.character;
			if (foldingRange.endCharacter !== undefined)
				foldingRange.endCharacter = vueLoc.end.character;
			result.push(foldingRange);
		}
	}
	return result;
}
