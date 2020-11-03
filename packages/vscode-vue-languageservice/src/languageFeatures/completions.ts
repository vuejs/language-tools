import {
	Position,
	CompletionItem,
	CompletionList,
	Range,
	TextEdit,
	CompletionContext,
	CompletionItemKind,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import { CompletionData } from '../utils/types';
import * as html from 'vscode-html-languageservice';
import { SourceMap } from '../utils/sourceMaps';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript';
import { hyphenate, isGloballyWhitelisted } from '@vue/shared';
import { getWordRange } from '../utils/commons';
import * as globalServices from '../globalServices';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import * as emmet from 'vscode-emmet-helper';
import * as getEmbeddedDocument from './embeddedDocument';
import { languageIdToSyntax } from '@volar/shared';

export const triggerCharacter = {
	typescript: [".", "\"", "'", "`", "/", "@", "<", "#"],
	html: ['<', ':', '@'],
	css: ['.', '@'],
};
export const wordPatterns: { [lang: string]: RegExp } = {
	css: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
	less: /(#?-?\d*\.\d\w*%?)|(::?[\w-]+(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
	scss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g,
};

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	const getEmbeddedDoc = getEmbeddedDocument.register(sourceFiles);

	return (document: TextDocument, position: Position, context?: CompletionContext, getEmmetConfig?: (syntax: string) => Promise<emmet.EmmetConfiguration>) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = Range.create(position, position);

		const tsResult = getTsResult(sourceFile);
		if (tsResult.items.length) return tsResult;

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult.items.length) return htmlResult;

		const cssResult = getCssResult(sourceFile);
		if (cssResult.items.length) return cssResult;

		return getEmmetResult();

		function getTsResult(sourceFile: SourceFile) {
			const result: CompletionList = {
				isIncomplete: false,
				items: [],
			};
			if (context?.triggerCharacter && !triggerCharacter.typescript.includes(context.triggerCharacter)) {
				return result;
			}
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				const virtualLocs = sourceMap.sourceToTargets(range);
				for (const virtualLoc of virtualLocs) {
					if (!virtualLoc.maped.data.capabilities.completion) continue;
					const quotePreference = virtualLoc.maped.data.vueTag === 'template' ? 'single' : 'auto';
					let tsItems = tsLanguageService.doComplete(sourceMap.targetDocument, virtualLoc.range.start, {
						quotePreference,
						includeCompletionsForModuleExports: virtualLoc.maped.data.vueTag === 'script', // TODO: read ts config
						triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
					});
					if (virtualLoc.maped.data.vueTag === 'template') {
						tsItems = tsItems.filter(tsItem => {
							const sortText = Number(tsItem.sortText);
							if (Number.isNaN(sortText))
								return true;
							if (sortText < 4)
								return true;
							if (isGloballyWhitelisted(tsItem.label))
								return true;
							return false;
						});
					}
					const vueItems: CompletionItem[] = tsItems.map(tsItem => {
						const data: CompletionData = {
							uri: document.uri,
							docUri: sourceMap.targetDocument.uri,
							mode: 'ts',
							tsItem: tsItem,
						};
						const vueItem: CompletionItem = {
							...tsItem,
							additionalTextEdits: translateAdditionalTextEdits(tsItem.additionalTextEdits, sourceMap),
							textEdit: translateTextEdit(tsItem.textEdit, sourceMap),
							data,
						};
						return vueItem;
					});
					result.items = result.items.concat(vueItems);
				}
			}
			result.items = result.items.filter(result => !result.label.startsWith('__VLS_'));
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: CompletionList = {
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
							if (name.length > 2 && hyphenate(name).startsWith('on-')) {
								const propName = '@' + hyphenate(name).substr('on-'.length);
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
								});
								tsItems.set(propKey, prop);
							}
						}
					}
					else {
						const attributes: html.IAttributeData[] = [];
						for (const prop of bind) {
							const name: string = prop.data.name;
							if (name.length > 2 && hyphenate(name).startsWith('on-')) {
								const propName = '@' + hyphenate(name).substr('on-'.length);
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
								});
								tsItems.set(propKey, prop);
							}
						}
						for (const event of on) {
							const propName = '@' + event.data.name;
							const propKey = componentName + ':' + propName;
							attributes.push({
								name: propName,
								description: propKey, // TODO: should not show in hover
							});
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
				globalServices.html.setDataProviders(true, [dataProvider]);

				const virtualLocs = sourceMap.sourceToTargets(range);
				for (const virtualLoc of virtualLocs) {
					const htmlResult = globalServices.html.doComplete(sourceMap.targetDocument, virtualLoc.range.start, sourceMap.htmlDocument);
					if (htmlResult.isIncomplete) {
						result.isIncomplete = true;
					}
					const vueItems: CompletionItem[] = htmlResult.items.map(htmlItem => ({
						...htmlItem,
						additionalTextEdits: translateAdditionalTextEdits(htmlItem.additionalTextEdits, sourceMap),
						textEdit: translateTextEdit(htmlItem.textEdit, sourceMap),
					}));
					const htmlItemsMap = new Map<string, html.CompletionItem>();
					for (const entry of htmlResult.items) {
						htmlItemsMap.set(entry.label, entry);
					}
					for (const vueItem of vueItems) {
						const documentation = typeof vueItem.documentation === 'string' ? vueItem.documentation : vueItem.documentation?.value;
						const tsItem = documentation ? tsItems.get(documentation) : undefined;
						if (vueItem.label.startsWith(':')) {
							vueItem.sortText = '\u0000' + vueItem.sortText;
						}
						else if (vueItem.label.startsWith('@')) {
							vueItem.sortText = '\u0001' + vueItem.sortText;
						}
						if (tsItem && !documentation?.startsWith('*:')) { // not globalAttributes
							vueItem.sortText = '\u0000' + vueItem.sortText;
							vueItem.kind = CompletionItemKind.Field;
						}
						else if (vueItem.label.startsWith('v-')) {
							vueItem.kind = CompletionItemKind.Method;
							vueItem.sortText = '\u0002' + vueItem.sortText;
						}
						else {
							vueItem.sortText = '\u0001' + vueItem.sortText;
						}
						const data: CompletionData = {
							mode: 'html',
							uri: document.uri,
							docUri: sourceMap.targetDocument.uri,
							tsItem: tsItem,
						};
						vueItem.data = data;
					}
					result.items = result.items.concat(vueItems);
				}
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			const result: CompletionList = {
				isIncomplete: false,
				items: [],
			};
			if (context?.triggerCharacter && !triggerCharacter.css.includes(context.triggerCharacter)) {
				return result;
			}
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssLanguageService = globalServices.getCssService(sourceMap.targetDocument.languageId);
				const virtualLocs = sourceMap.sourceToTargets(range);
				for (const virtualLoc of virtualLocs) {
					const wordPattern = wordPatterns[sourceMap.targetDocument.languageId] ?? wordPatterns.css;
					const wordRange = getWordRange(wordPattern, virtualLoc.range, sourceMap.targetDocument);
					const cssResult = cssLanguageService.doComplete(sourceMap.targetDocument, virtualLoc.range.start, sourceMap.stylesheet);
					if (cssResult.isIncomplete) {
						result.isIncomplete = true;
					}
					const data: CompletionData = {
						uri: document.uri,
						docUri: sourceMap.targetDocument.uri,
						mode: 'css',
					};
					const vueItems: CompletionItem[] = cssResult.items.map(cssItem => {
						const newText = cssItem.textEdit?.newText || cssItem.insertText || cssItem.label;
						const textEdit = translateTextEdit(TextEdit.replace(wordRange, newText), sourceMap);
						const addTextEdits = translateAdditionalTextEdits(cssItem.additionalTextEdits, sourceMap);
						return {
							...cssItem,
							additionalTextEdits: addTextEdits,
							textEdit: textEdit,
							data,
						};

					}
					);
					result.items = result.items.concat(vueItems);
				}
			}
			return result;
		}
		async function getEmmetResult() {
			if (!getEmmetConfig) return;
			const embededDoc = getEmbeddedDoc(document, { start: position, end: position });
			if (embededDoc) {
				const emmetConfig = await getEmmetConfig(embededDoc.document.languageId);
				if (emmetConfig) {
					let syntax = languageIdToSyntax(embededDoc.document.languageId);
					if (syntax === 'vue') syntax = 'html';
					const emmetResult = emmet.doComplete(embededDoc.document, embededDoc.range.start, syntax, emmetConfig);
					if (emmetResult && embededDoc.sourceMap) {
						for (const item of emmetResult.items) {
							if (item.textEdit) {
								item.textEdit = translateTextEdit(item.textEdit, embededDoc.sourceMap);
							}
							if (item.additionalTextEdits) {
								item.additionalTextEdits = translateAdditionalTextEdits(item.additionalTextEdits, embededDoc.sourceMap);
							}
						}
					}
					return emmetResult;
				}
			}
		}
	}
}

export function translateAdditionalTextEdits(additionalTextEdits: TextEdit[] | undefined, sourceMap: SourceMap) {
	if (additionalTextEdits) {
		const newAdditionalTextEdits: TextEdit[] = [];
		for (const textEdit of additionalTextEdits) {
			const vueLoc = sourceMap.targetToSource(textEdit.range);
			if (vueLoc) {
				newAdditionalTextEdits.push({
					newText: textEdit.newText,
					range: vueLoc.range,
				});
			}
		}
		return newAdditionalTextEdits;
	}
	return undefined;
}
export function translateTextEdit(textEdit: TextEdit | html.InsertReplaceEdit | undefined, sourceMap: SourceMap) {
	if (textEdit && TextEdit.is(textEdit)) {
		const vueLoc = sourceMap.targetToSource(textEdit.range);
		if (vueLoc) {
			return {
				newText: textEdit.newText,
				range: vueLoc.range,
			};
		}
	}
	return undefined;
}
