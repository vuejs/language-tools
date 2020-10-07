import {
	Position,
	CompletionItem,
	CompletionList,
	Range,
	TextEdit,
	CompletionContext,
	CompletionTriggerKind,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { CompletionData } from '../utils/types';
import * as html from 'vscode-html-languageservice';
import * as css from 'vscode-css-languageservice';
import { SourceMap } from '../utils/sourceMaps';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, position: Position, context?: CompletionContext): CompletionItem[] | CompletionList | undefined => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = Range.create(position, position);

		const tsResult = getTsResult(sourceFile);
		if (tsResult.items.length) return tsResult;

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult.items.length) return htmlResult as CompletionList;

		const cssResult = getCssResult(sourceFile);
		if (cssResult.items.length) return cssResult as CompletionList;

		function getTsResult(sourceFile: SourceFile) {
			const isIncomplete = context?.triggerKind !== CompletionTriggerKind.TriggerForIncompleteCompletions;
			const result: CompletionList = {
				isIncomplete,
				items: [],
			};
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				const virtualLocs = sourceMap.findVirtualLocations(range);
				for (const virtualLoc of virtualLocs) {
					if (!virtualLoc.data.capabilities.completion) continue;
					const quotePreference = virtualLoc.data.vueTag === 'template' ? 'single' : 'auto';
					const items = sourceMap.languageService.doComplete(sourceMap.virtualDocument, virtualLoc.range.start, {
						quotePreference,
						includeCompletionsForModuleExports: !isIncomplete,
						triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
					});
					const sourceItems = items.map(item => toSourceItem(item, sourceMap));
					const data: CompletionData = {
						uri: document.uri,
						docUri: sourceMap.virtualDocument.uri,
						mode: 'ts',
					};
					for (const entry of sourceItems) {
						if (!entry.data) entry.data = {};
						entry.data = {
							...entry.data,
							...data,
						}
						result.items.push(entry as CompletionItem);
					}
				}
			}
			result.items = result.items.filter(result => !result.label.startsWith('__VLS_'));
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: html.CompletionList = {
				isIncomplete: false,
				items: [],
			};

			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				const componentProps = sourceFile.getComponentProps();
				const customTags: html.ITagData[] = [];
				const tsItems = new Map<string, CompletionItem>();
				for (const [name, props] of componentProps) {
					customTags.push({
						name: name,
						// description: '', // TODO
						attributes: props.map(prop => {
							const name = ':' + prop.data.name;
							tsItems.set(name, prop);
							return {
								name,
							}
						}),
					});
				}
				const dataProvider = html.newHTMLDataProvider(document.uri, {
					version: 1.1,
					tags: customTags,
				});
				sourceMap.languageService.setDataProviders(true, [dataProvider]);

				const virtualLocs = sourceMap.findVirtualLocations(range);
				for (const virtualLoc of virtualLocs) {
					const newResult = sourceMap.languageService.doComplete(sourceMap.virtualDocument, virtualLoc.range.start, sourceMap.htmlDocument, {
						[document.uri]: true,
					});
					newResult.items = newResult.items.map(item => toSourceItem(item, sourceMap));
					if (newResult.isIncomplete) {
						result.isIncomplete = true;
					}
					const data: CompletionData = {
						uri: document.uri,
						docUri: sourceMap.virtualDocument.uri,
						mode: 'html',
					};
					for (const entry of newResult.items) {
						if (!entry.data) entry.data = {};
						const tsItem = tsItems.get(entry.label);
						entry.data = {
							...entry.data,
							...data,
							tsItem,
						};
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
				const virtualLocs = sourceMap.findVirtualLocations(range);
				for (const virtualLoc of virtualLocs) {
					const newResult = sourceMap.languageService.doComplete(sourceMap.virtualDocument, virtualLoc.range.start, sourceMap.stylesheet);
					newResult.items = newResult.items.map(item => toSourceItem(item, sourceMap));
					if (newResult.isIncomplete) {
						result.isIncomplete = true;
					}
					const data: CompletionData = {
						uri: document.uri,
						docUri: sourceMap.virtualDocument.uri,
						mode: 'css',
					};
					for (const entry of newResult.items) {
						if (!entry.data) entry.data = {};
						entry.data = {
							...entry.data,
							...data,
						}
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
			const vueLoc = sourceMap.findFirstVueLocation(textEdit.range);
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
		const vueLoc = sourceMap.findFirstVueLocation(entry.textEdit.range);
		if (vueLoc) {
			entry.textEdit = {
				newText: entry.textEdit.newText,
				range: vueLoc.range,
			};
		}
	}
	return entry;
}
