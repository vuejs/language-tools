import * as shared from '@volar/shared';
import { transformSelectionRanges } from '@volar/transforms';
import type * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceHost } from 'vscode-typescript-languageservice';
import type { SourceFile } from '../sourceFile';
import type { DocumentServiceRuntimeContext } from '../types';
import { getDummyTsLs } from '../utils/sharedLs';
import * as ts2 from 'vscode-typescript-languageservice';

export function register(
	context: DocumentServiceRuntimeContext,
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
) {

	const { typescript: ts, htmlLs, pugLs, getCssLs, getStylesheet, getPugDocument } = context;

	return (document: TextDocument, positions: vscode.Position[]) => {

		const sourceFile = context.getVueDocument(document);
		if (!sourceFile) {
			// take over mode
			const dummyTsLs = getDummyTsLs(ts, ts2, document, getPreferences, getFormatOptions);
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
				const dummyTsLs = getDummyTsLs(ts, ts2, sourceMap.mappedDocument, getPreferences, getFormatOptions);
				const tsStarts = positions.map(position => sourceMap.getMappedRange(position)?.[0].start).filter(shared.notEmpty);
				const tsSelectRange = dummyTsLs.getSelectionRanges(sourceMap.mappedDocument.uri, tsStarts);
				result = result.concat(transformSelectionRanges(
					tsSelectRange,
					range => sourceMap.getSourceRange(range.start, range.end)?.[0],
				));
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			let result: vscode.SelectionRange[] = [];
			for (const sourceMap of sourceFile.getTemplateSourceMaps()) {

				const htmlStarts = positions.map(position => sourceMap.getMappedRange(position)?.[0].start).filter(shared.notEmpty);
				const pugDocument = getPugDocument(sourceMap.mappedDocument);
				const selectRanges =
					sourceMap.mappedDocument.languageId === 'html' ? htmlLs.getSelectionRanges(sourceMap.mappedDocument, htmlStarts)
						: pugDocument ? pugLs.getSelectionRanges(pugDocument, htmlStarts)
							: []

				result = result.concat(transformSelectionRanges(
					selectRanges,
					range => sourceMap.getSourceRange(range.start, range.end)?.[0],
				));
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: vscode.SelectionRange[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {

				const stylesheet = getStylesheet(sourceMap.mappedDocument);
				const cssLs = getCssLs(sourceMap.mappedDocument.languageId);

				if (!cssLs || !stylesheet)
					continue;

				const cssStarts = positions.map(position => sourceMap.getMappedRange(position)?.[0].start).filter(shared.notEmpty);
				const cssSelectRanges = cssLs.getSelectionRanges(sourceMap.mappedDocument, cssStarts, stylesheet);
				result = result.concat(transformSelectionRanges(
					cssSelectRanges,
					range => sourceMap.getSourceRange(range.start, range.end)?.[0],
				));
			}
			return result;
		}
	}
}
