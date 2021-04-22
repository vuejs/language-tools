import { getWordStart, languageIdToSyntax } from '@volar/shared';
import { transformCompletionItem, transformCompletionList } from '@volar/transforms';
import { hyphenate, isGloballyWhitelisted } from '@vue/shared';
import type * as ts from 'typescript';
import * as path from 'upath';
import * as emmet from 'vscode-emmet-helper';
import type { TextDocument } from 'vscode-html-languageservice';
import * as html from 'vscode-html-languageservice';
import {
	CompletionItem,
	CompletionItemKind,
	CompletionList,
	Position,
	Range,
	TextEdit
} from 'vscode-languageserver-types';
import { CompletionContext } from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFile';
import type { TsApiRegisterOptions } from '../types';
import { CompletionData } from '../types';
import * as languageServices from '../utils/languageServices';
import * as getEmbeddedDocument from './embeddedDocument';

export const triggerCharacter = {
	typescript: [".", "\"", "'", "`", "/", "@", "<", "#"],
	html: ['<', ':', '@', '.'/* Event Modifiers */],
	css: ['.', '@'],
};
export const wordPatterns: { [lang: string]: RegExp } = {
	css: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
	less: /(#?-?\d*\.\d\w*%?)|(::?[\w-]+(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
	scss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g,
	postcss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g, // scss
};
export const vueTags: html.ITagData[] = [
	{
		name: 'template',
		attributes: [
			{
				name: 'lang',
				values: [
					{ name: 'html' },
					{ name: 'pug' },
				],
			},
		],
	},
	{
		name: 'script',
		attributes: [
			{
				name: 'lang',
				values: [
					{ name: 'js' },
					{ name: 'ts' },
					{ name: 'jsx' },
					{ name: 'tsx' },
				],
			},
			{ name: 'setup' },
		],
	},
	{
		name: 'style',
		attributes: [
			{
				name: 'lang',
				values: [
					{ name: 'css' },
					{ name: 'scss' },
					{ name: 'less' },
				],
			},
			{ name: 'scoped', valueSet: 'v' },
			{ name: 'module', valueSet: 'v' },
		],
	},
];
// https://v3.vuejs.org/api/directives.html#v-on
export const eventModifiers: Record<string, string> = {
	stop: 'call event.stopPropagation().',
	prevent: 'call event.preventDefault().',
	capture: 'add event listener in capture mode.',
	self: 'only trigger handler if event was dispatched from this element.',
	// {keyAlias}: 'only trigger handler on certain keys.',
	once: 'trigger handler at most once.',
	left: 'only trigger handler for left button mouse events.',
	right: 'only trigger handler for right button mouse events.',
	middle: 'only trigger handler for middle button mouse events.',
	passive: 'attaches a DOM event with { passive: true }.',
};

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {
	const getEmbeddedDoc = getEmbeddedDocument.register(arguments[0]);

	return async (uri: string, position: Position, context?: CompletionContext, getEmmetConfig?: (syntax: string) => emmet.VSCodeEmmetConfig) => {
		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const tsResult = getTsResult(sourceFile);
		if (tsResult) return tsResult;

		const emmetResult = getEmmetResult(sourceFile);

		// precede html for support inline css service
		const cssResult = getCssResult(sourceFile);
		if (cssResult) return withEmmetResult(cssResult, emmetResult);

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult) return withEmmetResult(htmlResult, emmetResult);

		const vueResult = getVueResult(sourceFile);
		if (vueResult) return withEmmetResult(vueResult, emmetResult);

		return emmetResult;

		function withEmmetResult(a: CompletionList, b?: CompletionList): CompletionList {
			return {
				isIncomplete: a.isIncomplete || !!b?.isIncomplete,
				items: b ? a.items.concat(b.items) : a.items,
			};
		}
		function getTsResult(sourceFile: SourceFile) {
			let result: CompletionList | undefined = undefined;
			if (context?.triggerCharacter && !triggerCharacter.typescript.includes(context.triggerCharacter)) {
				return result;
			}
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				const tsRanges = sourceMap.getMappedRanges(position);
				for (const tsRange of tsRanges) {
					if (!tsRange.data.capabilities.completion) continue;
					if (!result) {
						result = {
							isIncomplete: false,
							items: [],
						};
					}
					const quotePreference = tsRange.data.vueTag === 'template' ? 'single' : 'auto';
					let tsItems = tsLanguageService.doComplete(sourceMap.mappedDocument.uri, tsRange.start, {
						quotePreference,
						includeCompletionsForModuleExports: ['script', 'scriptSetup'].includes(tsRange.data.vueTag ?? ''), // TODO: read ts config
						triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
					});
					if (tsRange.data.vueTag === 'template') {
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
						const vueItem = transformCompletionItem(
							tsItem,
							tsRange => sourceMap.getSourceRange(tsRange.start, tsRange.end),
						);
						const data: CompletionData = {
							uri: uri,
							docUri: sourceMap.mappedDocument.uri,
							mode: 'ts',
							tsItem: tsItem,
						};
						vueItem.data = data;
						return vueItem;
					});
					result.items = result.items.concat(vueItems);
				}
			}
			if (result) {
				result.items = result.items.filter(result => result.label.indexOf('__VLS_') === -1);
			}
			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			let result: CompletionList | undefined = undefined;
			if (context?.triggerCharacter && !triggerCharacter.html.includes(context.triggerCharacter)) {
				return;
			}
			for (const sourceMap of [...sourceFile.getHtmlSourceMaps(), ...sourceFile.getPugSourceMaps()]) {
				const componentCompletion = sourceFile.getComponentCompletionData();
				const tags: html.ITagData[] = [];
				const tsItems = new Map<string, CompletionItem>();
				const globalAttributes: html.IAttributeData[] = [
					{ name: 'v-if' },
					{ name: 'v-else-if' },
					{ name: 'v-else', valueSet: 'v' },
					{ name: 'v-for' },
				];
				const slots: html.IAttributeData[] = [];
				for (const [componentName, { item, bind, on, slot }] of componentCompletion) {
					if (componentName === '*') {
						for (const prop of bind) {
							const name: string = prop.data.name;
							if (name.length > 2 && hyphenate(name).startsWith('on-')) {
								const propName = '@' + hyphenate(name).substr('on-'.length);
								const propKey = componentName + ':' + propName;
								globalAttributes.push({
									name: propName,
									description: propKey,
								});
								tsItems.set(propKey, prop);
							}
							else {
								const propName = ':' + hyphenate(name);
								const propKey = componentName + ':' + propName;
								globalAttributes.push({
									name: propName,
									description: propKey,
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
									description: propKey,
								});
								tsItems.set(propKey, prop);
							}
							else {
								const propName = ':' + hyphenate(name);
								const propKey = componentName + ':' + propName;
								attributes.push({
									name: propName,
									description: propKey,
								});
								tsItems.set(propKey, prop);
							}
						}
						for (const event of on) {
							const propName = '@' + hyphenate(event.data.name);
							const propKey = componentName + ':' + propName;
							attributes.push({
								name: propName,
								description: propKey,
							});
							tsItems.set(propKey, event);
						}
						for (const _slot of slot) {
							const propName = '#' + _slot.data.name;
							const propKey = componentName + ':' + propName;
							slots.push({
								name: propName,
								description: propKey,
							});
							tsItems.set(propKey, _slot);
						}
						if (item) {
							tags.push({
								name: componentName,
								description: componentName + ':',
								attributes,
							});
							tsItems.set(componentName + ':', item);
						}
						else {
							tags.push({
								name: componentName,
								attributes,
							});
						}
					}
				}
				tags.push({
					name: 'template',
					attributes: slots,
				});
				const dataProvider = html.newHTMLDataProvider(uri, {
					version: 1.1,
					tags,
					globalAttributes,
				});
				languageServices.html.setDataProviders(true, [dataProvider]);

				for (const htmlRange of sourceMap.getMappedRanges(position)) {
					if (!result) {
						result = {
							isIncomplete: false,
							items: [],
						};
					}
					const htmlResult = sourceMap.language === 'html'
						? languageServices.html.doComplete(sourceMap.mappedDocument, htmlRange.start, sourceMap.htmlDocument)
						: languageServices.pug.doComplete(sourceMap.pugDocument, htmlRange.start)
					if (!htmlResult) continue;
					if (htmlResult.isIncomplete) {
						result.isIncomplete = true;
					}

					const replacement = getReplacement(htmlResult, sourceMap.mappedDocument);
					if (replacement) {
						const isEvent = replacement.text.startsWith('@') || replacement.text.startsWith('v-on:');
						const hasExt = replacement.text.includes('.');
						if (isEvent && hasExt) {
							const noExtText = path.trimExt(replacement.text, [], 999);
							for (const modifier in eventModifiers) {
								const modifierDes = eventModifiers[modifier];
								const newItem: html.CompletionItem = {
									label: modifier,
									filterText: noExtText + '.' + modifier,
									documentation: modifierDes,
									textEdit: {
										range: replacement.textEdit.range,
										newText: noExtText + '.' + modifier,
									},
									kind: CompletionItemKind.EnumMember,
								};
								htmlResult.items.push(newItem);
							}
						}
					}

					let vueItems = htmlResult.items.map(htmlItem => transformCompletionItem(
						htmlItem,
						htmlRange => sourceMap.getSourceRange(htmlRange.start, htmlRange.end),
					));
					const htmlItemsMap = new Map<string, html.CompletionItem>();
					for (const entry of htmlResult.items) {
						htmlItemsMap.set(entry.label, entry);
					}
					for (const vueItem of vueItems) {
						const documentation = typeof vueItem.documentation === 'string' ? vueItem.documentation : vueItem.documentation?.value;
						const tsItem = documentation ? tsItems.get(documentation) : undefined;
						if (tsItem) {
							vueItem.documentation = undefined;
						}
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
							uri: uri,
							docUri: sourceMap.mappedDocument.uri,
							tsItem: tsItem,
						};
						vueItem.data = data;
					}
					{ // filter HTMLAttributes
						const temp = new Map<string, CompletionItem>();
						for (const item of vueItems) {
							if (!temp.get(item.label)?.documentation) {
								temp.set(item.label, item);
							}
						}
						vueItems = [...temp.values()];
					}
					result.items = result.items.concat(vueItems);
				}
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: CompletionList | undefined = undefined;
			if (context?.triggerCharacter && !triggerCharacter.css.includes(context.triggerCharacter)) {
				return;
			}
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssRanges = sourceMap.getMappedRanges(position);
				for (const cssRange of cssRanges) {
					if (!result) {
						result = {
							isIncomplete: false,
							items: [],
						};
					}
					const cssLanguageService = languageServices.getCssLanguageService(sourceMap.mappedDocument.languageId);
					if (!cssLanguageService || !sourceMap.stylesheet) continue;
					const wordPattern = wordPatterns[sourceMap.mappedDocument.languageId] ?? wordPatterns.css;
					const wordStart = getWordStart(wordPattern, cssRange.end, sourceMap.mappedDocument);
					const wordRange: Range = wordStart ? { start: wordStart, end: cssRange.end } : cssRange;
					const cssResult = cssLanguageService.doComplete(sourceMap.mappedDocument, cssRange.start, sourceMap.stylesheet);
					if (cssResult.isIncomplete) {
						result.isIncomplete = true;
					}
					const data: CompletionData = {
						uri: uri,
						docUri: sourceMap.mappedDocument.uri,
						mode: 'css',
					};
					const vueItems: CompletionItem[] = cssResult.items.map(cssItem => {
						const newText = cssItem.textEdit?.newText || cssItem.insertText || cssItem.label;
						cssItem.textEdit = TextEdit.replace(wordRange, newText);
						const vueItem = transformCompletionItem(
							cssItem,
							cssRange => sourceMap.getSourceRange(cssRange.start, cssRange.end),
						);
						vueItem.data = data;
						return vueItem;
					}
					);
					result.items = result.items.concat(vueItems);
				}
			}
			return result;
		}
		function getVueResult(sourceFile: SourceFile) {
			const embededDoc = getEmbeddedDoc(uri, { start: position, end: position });
			if (embededDoc) {
				let syntax = languageIdToSyntax(embededDoc.language);
				if (syntax === 'vue') {
					const dataProvider = html.newHTMLDataProvider(uri, {
						version: 1.1,
						tags: vueTags,
					});
					languageServices.html.setDataProviders(false, [dataProvider]);
					return languageServices.html.doComplete(sourceFile.getTextDocument(), position, sourceFile.getVueHtmlDocument());
				}
			}
		}
		function getEmmetResult(sourceFile: SourceFile) {
			if (!getEmmetConfig) return;
			const embededDoc = getEmbeddedDoc(uri, { start: position, end: position });
			if (embededDoc) {
				const emmetConfig = getEmmetConfig(embededDoc.language);
				if (emmetConfig) {
					let syntax = languageIdToSyntax(embededDoc.language);
					if (syntax === 'vue') syntax = 'html';
					const doc = embededDoc.document ?? sourceFile.getTextDocument();
					const emmetResult = emmet.doComplete(doc, embededDoc.range.start, syntax, emmetConfig);
					if (emmetResult && embededDoc.sourceMap) {
						return transformCompletionList(
							emmetResult,
							emmetRange => embededDoc.sourceMap!.getSourceRange(emmetRange.start, emmetRange.end),
						);
					}
					return emmetResult;
				}
			}
		}
	}
}

function getReplacement(list: html.CompletionList, doc: TextDocument) {
	for (const item of list.items) {
		if (item.textEdit && 'range' in item.textEdit) {
			return {
				item: item,
				textEdit: item.textEdit,
				text: doc.getText(item.textEdit.range)
			};
		}
	}
}
