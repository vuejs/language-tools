import {
	Position,
	CompletionItem,
	CompletionList,
	Range,
	TextEdit,
	CompletionContext,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { TsCompletionData } from '../utils/types';
import * as html from 'vscode-html-languageservice';
import * as css from 'vscode-css-languageservice';
import { SourceMap } from '../utils/sourceMaps';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { hyphenate } from '@vue/shared';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, position: Position, context?: CompletionContext): CompletionItem[] | CompletionList | undefined => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = Range.create(position, position);

		const tsResult = getTsResult(sourceFile);
		if (tsResult.length) return tsResult;

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult) return htmlResult as CompletionList;

		const cssResult = getCssResult(sourceFile);
		if (cssResult) return cssResult as CompletionList;

		function getTsResult(sourceFile: SourceFile) {
			let result: CompletionItem[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				const virtualLocs = sourceMap.findTargets(range);
				for (const virtualLoc of virtualLocs) {
					if (!virtualLoc.data.capabilities.basic) continue;

					const quotePreference = virtualLoc.data.vueTag === 'template' ? 'single' : 'auto';
					const items = sourceMap.languageService.doComplete(sourceMap.targetDocument, virtualLoc.range.start, { quotePreference }, context);
					const sourceItems = items.map(item => toSourceItem(item, sourceMap));

					const data: TsCompletionData = {
						mode: 'ts',
						languageService: sourceMap.languageService,
						document: sourceMap.targetDocument,
						position: virtualLoc.range.start,
					};
					for (const entry of sourceItems) {
						entry.data = data;
						result.push(entry as CompletionItem);
					}
				}
			}
			result = result.filter(result => !result.label.startsWith('__VLS_'));
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: html.CompletionList = {
				isIncomplete: false,
				items: [],
			};
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				const virtualLocs = sourceMap.findTargets(range);
				for (const virtualLoc of virtualLocs) {
					const templateScriptData = sourceFile.getTemplateScriptData();
					const names = [...new Set(...templateScriptData.components, ...templateScriptData.components.map(hyphenate))];
					const dataProvider = html.newHTMLDataProvider(document.uri, {
						version: 1.1,
						tags: names.map(name => ({
							name: name,
							description: 'Volar: TODO',
							attributes: [],
						})),
					});
					sourceMap.languageService.setDataProviders(true, [dataProvider]);
					const newResult = sourceMap.languageService.doComplete(sourceMap.targetDocument, virtualLoc.range.start, sourceMap.htmlDocument, { [document.uri]: true });
					newResult.items = newResult.items.map(item => toSourceItem(item, sourceMap));
					if (newResult.isIncomplete) {
						result.isIncomplete = true;
					}
					result.items = result.items.concat(newResult.items);
				}
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			const result: html.CompletionList = {
				isIncomplete: false,
				items: [],
			};
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const virtualLocs = sourceMap.findTargets(range);
				for (const virtualLoc of virtualLocs) {
					const newResult = sourceMap.languageService.doComplete(sourceMap.targetDocument, virtualLoc.range.start, sourceMap.stylesheet);
					newResult.items = newResult.items.map(item => toSourceItem(item, sourceMap));
					if (newResult.isIncomplete) {
						result.isIncomplete = true;
					}
					result.items = result.items.concat(newResult.items);
				}
			}
			return result;
		}
	}
}

function toSourceItem<T extends CompletionItem | css.CompletionItem>(entry: T, sourceMap: SourceMap): T {
	if (entry.additionalTextEdits) {
		const newAdditionalTextEdits: TextEdit[] = [];
		for (const textEdit of entry.additionalTextEdits) {
			const vueLoc = sourceMap.findSource(textEdit.range);
			if (vueLoc) {
				newAdditionalTextEdits.push({
					newText: textEdit.newText,
					range: vueLoc.range,
				});
			}
		}
		entry.additionalTextEdits = newAdditionalTextEdits;
	}
	if (entry.textEdit && TextEdit.is(entry.textEdit)) {
		const vueLoc = sourceMap.findSource(entry.textEdit.range);
		if (vueLoc) {
			entry.textEdit = {
				newText: entry.textEdit.newText,
				range: vueLoc.range,
			};
		}
	}
	return entry;
}
