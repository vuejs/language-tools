import {
	Position,
	CompletionItem,
	CompletionList,
	Range,
	TextEdit,
	CompletionContext,
	CompletionTriggerKind,
	CompletionItemKind,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { CompletionData } from '../utils/types';
import * as html from 'vscode-html-languageservice';
import * as css from 'vscode-css-languageservice';
import { SourceMap } from '../utils/sourceMaps';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript';
import { hyphenate } from '@vue/shared';
import * as upath from 'upath';

export const triggerCharacter = {
	typescript: [".", "\"", "'", "`", "/", "@", "<", "#"],
	html: ['<'],
};

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
			const result: CompletionList = {
				isIncomplete: false,
				items: [],
			};
			if (context?.triggerCharacter && !triggerCharacter.typescript.includes(context.triggerCharacter)) {
				return result;
			}
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				const virtualLocs = sourceMap.findVirtualLocations(range);
				for (const virtualLoc of virtualLocs) {
					if (!virtualLoc.maped.data.capabilities.completion) continue;
					const quotePreference = virtualLoc.maped.data.vueTag === 'template' ? 'single' : 'auto';
					const items = sourceMap.languageService.doComplete(sourceMap.virtualDocument, virtualLoc.range.start, {
						quotePreference,
						includeCompletionsForModuleExports: true, // TODO: read ts config
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
						};
						// patch import completion icon
						if (entry.detail?.endsWith('vue.ts')) {
							entry.detail = upath.trimExt(entry.detail);
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
			if (context?.triggerCharacter && !triggerCharacter.html.includes(context.triggerCharacter)) {
				return result;
			}
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				const componentCompletion = sourceFile.getComponentCompletionData();
				const tags: html.ITagData[] = [];
				const tsItems = new Map<string, CompletionItem>();
				const globalAttributes: html.IAttributeData[] = [
					// TODO: hardcode
					{ name: 'v-if' },
					{ name: 'v-else-if' },
					{ name: 'v-else' },
					{ name: 'v-for' },
				];
				for (const [componentName, { bind, on }] of componentCompletion) {
					if (componentName === '*') {
						for (const prop of bind) {
							const name: string = prop.data.name;
							if (name.length > 2 && name.startsWith('on') && name[2].toUpperCase() === name[2]) {
								const propName = '@' + name[2].toLowerCase() + name.substr(3);
								const propKey = componentName + ':' + propName;
								globalAttributes.push({
									name: propName,
									description: propKey, // TODO: should not show in hover
								});
								tsItems.set(propKey, prop);
							}
							else {
								const propName = ':' + hyphenate(name);
								const propKey = componentName + ':' + propName;
								globalAttributes.push({
									name: propName,
									description: propKey, // TODO: should not show in hover
								})
								tsItems.set(propKey, prop);
							}
						}
					}
					else {
						const attributes: html.IAttributeData[] = [];
						for (const prop of bind) {
							const name: string = prop.data.name;
							if (name.length > 2 && name.startsWith('on') && name[2].toUpperCase() === name[2]) {
								const propName = '@' + name[2].toLowerCase() + name.substr(3);
								const propKey = componentName + ':' + propName;
								attributes.push({
									name: propName,
									description: propKey, // TODO: should not show in hover
								});
								tsItems.set(propKey, prop);
							}
							else {
								const propName = ':' + hyphenate(name);
								const propKey = componentName + ':' + propName;
								attributes.push({
									name: propName,
									description: propKey, // TODO: should not show in hover
								})
								tsItems.set(propKey, prop);
							}
						}
						for (const event of on) {
							const propName = '@' + event.data.name;
							const propKey = componentName + ':' + propName;
							attributes.push({
								name: propName,
								description: propKey, // TODO: should not show in hover
							})
							tsItems.set(propKey, event);
						}
						tags.push({
							name: componentName,
							// description: '', // TODO: component description
							attributes,
						});
					}
				}
				const dataProvider = html.newHTMLDataProvider(document.uri, {
					version: 1.1,
					tags,
					globalAttributes,
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
					const itemsMap = new Map<string, html.CompletionItem>();
					for (const entry of newResult.items) {
						itemsMap.set(entry.label, entry);
					}
					for (const entry of newResult.items) {
						const documentation = typeof entry.documentation === 'string' ? entry.documentation : entry.documentation?.value;
						const tsItem = documentation ? tsItems.get(documentation) : undefined;
						if (entry.label.startsWith(':')) {
							entry.kind = CompletionItemKind.Field;
							entry.label = entry.label.substr(1);
							entry.sortText = '\u0000' + entry.sortText;
						}
						else if (entry.label.startsWith('@')) {
							entry.kind = CompletionItemKind.Event;
							entry.label = entry.label.substr(1);
							entry.sortText = '\u0001' + entry.sortText;
						}
						if (tsItem && !documentation?.startsWith('*:')) { // not globalAttributes
							entry.sortText = '\u0000' + entry.sortText;
						}
						else if (entry.label.startsWith('v-')) {
							entry.kind = CompletionItemKind.Method;
							entry.sortText = '\u0002' + entry.sortText;
						}
						else {
							entry.sortText = '\u0001' + entry.sortText;
						}
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
