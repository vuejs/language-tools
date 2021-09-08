import * as shared from '@volar/shared';
import { transformSelectionRanges } from '@volar/transforms';
import type * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceHost } from 'vscode-typescript-languageservice';
import type { SourceFile } from '../sourceFile';
import type { HtmlLanguageServiceContext } from '../types';
import { getDummyTsLs } from '../utils/sharedLs';

export function register(
	context: HtmlLanguageServiceContext,
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
) {

	const { modules, htmlLs, pugLs, getCssLs } = context;

	return (document: TextDocument, positions: vscode.Position[]) => {

		const sourceFile = context.getVueDocument(document);
		if (!sourceFile) {
			// take over mode
			const dummyTsLs = getDummyTsLs(modules.typescript, modules.ts, document, getPreferences, getFormatOptions);
			return dummyTsLs.getSelectionRanges(document.uri, positions);
		}

		// const vueResult = getVueResult(sourceFile); // TODO
		const tsResult = getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = getCssResult(sourceFile);

		const embeddedResult = [
			...cssResult,
			...htmlResult,
			...tsResult,
		];

		// for (const embeddedRange of embeddedResult) {
		// 	const lastParent = findLastParent(embeddedRange);
		// 	for (const vueRange of vueResult) {
		// 		if (shared.isInsideRange(vueRange.range, lastParent.range)) {
		// 			lastParent.parent = vueRange;
		// 			break;
		// 		}
		// 	}
		// }

		return embeddedResult;

		// function findLastParent(range: vscode.SelectionRange) {
		// 	let parent = range;
		// 	while (range.parent) {
		// 		parent = range.parent;
		// 	}
		// 	return parent;
		// }
		function getVueResult(sourceFile: SourceFile) {

			const descriptor = sourceFile.getDescriptor();

			let emptyBlocksContent = document.getText();

			for (const block of [
				descriptor.script,
				descriptor.scriptSetup,
				descriptor.template,
				...descriptor.styles,
				...descriptor.customBlocks,
			].filter(shared.notEmpty)) {
				emptyBlocksContent = emptyBlocksContent.substring(0, block.startTagEnd) + ' '.repeat(block.content.length) + emptyBlocksContent.substring(block.startTagEnd + block.content.length);
			}

			let result: vscode.SelectionRange[] = [];
			result = result.concat(htmlLs.getSelectionRanges(TextDocument.create(document.uri, document.languageId, document.version, emptyBlocksContent), positions));
			return result;
		}
		function getTsResult(sourceFile: SourceFile) {
			const tsSourceMaps = [
				sourceFile.getTemplateFormattingScript().sourceMap,
				...sourceFile.docLsScripts().sourceMaps,
			].filter(shared.notEmpty);

			let result: vscode.SelectionRange[] = [];
			for (const sourceMap of tsSourceMaps) {
				if (!sourceMap.capabilities.foldingRanges)
					continue;
				const dummyTsLs = getDummyTsLs(modules.typescript, modules.ts, sourceMap.mappedDocument, getPreferences, getFormatOptions);
				const tsStarts = positions.map(position => sourceMap.getMappedRange(position)?.start).filter(shared.notEmpty);
				const tsSelectRange = dummyTsLs.getSelectionRanges(sourceMap.mappedDocument.uri, tsStarts);
				result = result.concat(transformSelectionRanges(tsSelectRange, range => sourceMap.getSourceRange(range.start, range.end)));
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			let result: vscode.SelectionRange[] = [];
			for (const sourceMap of [
				...sourceFile.getHtmlSourceMaps(),
				...sourceFile.getPugSourceMaps()
			]) {
				const htmlStarts = positions.map(position => sourceMap.getMappedRange(position)?.start).filter(shared.notEmpty);
				const selectRanges = sourceMap.language === 'html'
					? htmlLs.getSelectionRanges(sourceMap.mappedDocument, htmlStarts)
					: pugLs.getSelectionRanges(sourceMap.pugDocument, htmlStarts)
				result = result.concat(transformSelectionRanges(selectRanges, range => sourceMap.getSourceRange(range.start, range.end)));
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: vscode.SelectionRange[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssLs = getCssLs(sourceMap.mappedDocument.languageId);
				if (!cssLs || !sourceMap.stylesheet) continue;
				const cssStarts = positions.map(position => sourceMap.getMappedRange(position)?.start).filter(shared.notEmpty);
				const cssSelectRanges = cssLs.getSelectionRanges(sourceMap.mappedDocument, cssStarts, sourceMap.stylesheet);
				result = result.concat(transformSelectionRanges(cssSelectRanges, range => sourceMap.getSourceRange(range.start, range.end)));
			}
			return result;
		}
	}
}
