import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SourceFile } from '../sourceFile';
import type { SourceMap, TsSourceMap } from '../utils/sourceMaps';
import * as vscode from 'vscode-languageserver-protocol';
import { getDummyTsLs } from '../utils/sharedLs';
import * as shared from '@volar/shared';
import type { DocumentServiceRuntimeContext } from '../types';
import type { LanguageServiceHost } from 'vscode-typescript-languageservice';
import * as ts2 from 'vscode-typescript-languageservice';

export function register(
	context: DocumentServiceRuntimeContext,
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
) {
	const { htmlLs, pugLs, getCssLs, typescript: ts, getPugDocument } = context;
	return (document: TextDocument) => {

		const sourceFile = context.getVueDocument(document);
		if (!sourceFile) {
			// take over mode
			const dummyTsLs = getDummyTsLs(ts, ts2, document, getPreferences, getFormatOptions);
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
				const dummyTsLs = getDummyTsLs(ts, ts2, sourceMap.mappedDocument, getPreferences, getFormatOptions);
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
			for (const sourceMap of sourceFile.getTemplateSourceMaps()) {

				const pugDocument = getPugDocument(sourceMap.mappedDocument);
				if (!pugDocument)
					continue;

				const foldingRanges = pugLs.getFoldingRanges(pugDocument);
				result = result.concat(toVueFoldingRanges(foldingRanges, sourceMap));
			}
			return result;
		}
	}
}

function toVueFoldingRanges(virtualFoldingRanges: vscode.FoldingRange[], sourceMap: SourceMap) {
	const result: vscode.FoldingRange[] = [];
	for (const foldingRange of virtualFoldingRanges) {
		const vueRange = sourceMap.getSourceRange(
			{ line: foldingRange.startLine, character: foldingRange.startCharacter ?? 0 },
			{ line: foldingRange.endLine, character: foldingRange.endCharacter ?? 0 },
		)?.[0];
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
			data => !!data.capabilities.foldingRanges,
		)?.[0];
		if (vueLoc) {
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
