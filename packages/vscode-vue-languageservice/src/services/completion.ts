import * as shared from '@volar/shared';
import { transformCompletionItem, transformCompletionList } from '@volar/transforms';
import { computed, pauseTracking, resetTracking, ref } from '@vue/reactivity';
import { camelize, capitalize, hyphenate, isGloballyWhitelisted } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'upath';
import * as html from 'vscode-html-languageservice';
import * as ts2 from 'vscode-typescript-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Data, Data as TsCompletionData } from 'vscode-typescript-languageservice/src/services/completion';
import { SourceFile, ScriptSourceMap } from '@volar/vue-typescript';
import type { LanguageServiceRuntimeContext } from '../types';
import { CompletionData } from '../types';
import { untrack } from '../utils/untrack';
import * as getEmbeddedDocument from './embeddedDocument';
import * as emmet from '@vscode/emmet-helper';
import { SearchTexts } from '@volar/vue-typescript';

export function getTriggerCharacters(tsVersion: string) {
	return {
		typescript: ts2.getTriggerCharacters(tsVersion),
		jsdoc: ['*'],
		html: [
			'.', ':', '<', '"', '=', '/', // https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/html-language-features/server/src/htmlServer.ts#L183
			'@', // vue event shorthand
		],
		css: ['/', '-', ':'], // https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/css-language-features/server/src/cssServer.ts#L97
		json: ['"', ':'], // https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/json-language-features/server/src/jsonServer.ts#L150
	};
}
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
			{ name: 'setup', valueSet: 'v' },
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

export function register(
	{ typescript: ts, sourceFiles, getTsLs, htmlLs, pugLs, getCssLs, jsonLs, documentContext, vueHost, templateTsLs, getHtmlDataProviders, getStylesheet, getHtmlDocument, getJsonDocument, getPugDocument }: LanguageServiceRuntimeContext,
	getScriptContentVersion: () => number,
) {

	const getEmbeddedDoc = getEmbeddedDocument.register(arguments[0]);
	let cache: {
		uri: string,
		lists: {
			ts?: vscode.CompletionList,
			emmet?: vscode.CompletionList,
			jsDoc?: vscode.CompletionList,
			directiveComment?: vscode.CompletionList,
			css?: vscode.CompletionList,
			json?: vscode.CompletionList,
			html?: vscode.CompletionList,
			vue?: vscode.CompletionList,
		},
	} | undefined = undefined;
	const componentCompletionDataGetters = new WeakMap<SourceFile, ReturnType<typeof useComponentCompletionData>>();

	return async (
		uri: string,
		position: vscode.Position,
		context?: vscode.CompletionContext,
		/** internal */
		isEnabledComponentAutoImport?: () => Promise<boolean>,
		/** internal */
		getNameCases?: (uri: string) => Promise<{
			tagNameCase: 'both' | 'kebabCase' | 'pascalCase',
			attrNameCase: 'kebabCase' | 'camelCase',
		}>,
	) => {

		const sourceFile = sourceFiles.get(uri);
		const triggerCharacters = getTriggerCharacters(ts.version);

		if (context?.triggerKind === vscode.CompletionTriggerKind.TriggerForIncompleteCompletions && cache?.uri === uri) {
			if (cache.lists.ts?.isIncomplete) {
				cache.lists.ts = await getTsResult();
			}
			if (cache.lists.emmet?.isIncomplete) {
				cache.lists.emmet = sourceFile ? await getEmmetResult(sourceFile) : undefined;
			}
			if (cache.lists.jsDoc?.isIncomplete) {
				cache.lists.jsDoc = await getJsDocResult();
			}
			if (cache.lists.directiveComment?.isIncomplete) {
				cache.lists.jsDoc = await getDirectiveCommentResult();
			}
			if (cache.lists.css?.isIncomplete) {
				cache.lists.css = sourceFile ? await getCssResult(sourceFile) : undefined;
			}
			if (cache.lists.json?.isIncomplete) {
				cache.lists.json = sourceFile ? await getJsonResult(sourceFile) : undefined;
			}
			if (cache.lists.html?.isIncomplete) {
				cache.lists.html = sourceFile ? await getHtmlResult(sourceFile) : undefined;
			}
			if (cache.lists.vue?.isIncomplete) {
				cache.lists.vue = sourceFile ? await getVueResult(sourceFile) : undefined;
			}
			return combineCacheResults();
		}

		cache = { uri, lists: {} };
		cache.lists.emmet = sourceFile ? await getEmmetResult(sourceFile) : undefined;
		cache.lists.jsDoc = await getJsDocResult();
		cache.lists.directiveComment = await getDirectiveCommentResult();

		cache.lists.ts = await getTsResult();
		if (cache.lists.ts?.items.length) {
			return combineCacheResults();
		}

		// precede html for support inline css service
		cache.lists.css = sourceFile ? await getCssResult(sourceFile) : undefined;
		if (cache.lists.css?.items.length) {
			return combineCacheResults();
		}

		cache.lists.json = sourceFile ? await getJsonResult(sourceFile) : undefined;
		if (cache.lists.json?.items.length) {
			return combineCacheResults();
		}

		cache.lists.html = sourceFile ? await getHtmlResult(sourceFile) : undefined;
		if (cache.lists.html?.items.length) {
			return combineCacheResults();
		}

		cache.lists.vue = sourceFile ? await getVueResult(sourceFile) : undefined;
		if (cache.lists.vue?.items.length) {
			return combineCacheResults();
		}

		return combineCacheResults();

		function combineCacheResults() {
			const lists = cache ? Object.values(cache.lists) : [];
			const lists2 = lists.filter(shared.notEmpty);
			return {
				isIncomplete: lists2.some(list => list.isIncomplete),
				items: lists2.map(list => list.items).flat(),
			};
		}
		async function getTsResult() {
			let result: vscode.CompletionList | undefined;
			if (context?.triggerCharacter && !triggerCharacters.typescript.includes(context.triggerCharacter)) {
				return result;
			}
			for (const tsLoc of sourceFiles.toTsLocations(
				uri,
				position,
				position,
				data => !!data.capabilities.completion,
			)) {

				if (tsLoc.type === 'source-ts' && tsLoc.lsType !== 'script')
					continue;

				if (!result) {
					result = {
						isIncomplete: false,
						items: [],
					};
				}

				const inTemplate = tsLoc.type === 'embedded-ts' && tsLoc.data.vueTag === 'template';
				const options: ts.GetCompletionsAtPositionOptions = {
					triggerCharacter: context?.triggerCharacter as ts.CompletionsTriggerCharacter,
					triggerKind: context?.triggerKind,
					// includeCompletionsForModuleExports: true, // set in server/src/tsConfigs.ts
					includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
					...(inTemplate ? {
						quotePreference: 'single',
						includeCompletionsForModuleExports: false,
						includeCompletionsForImportStatements: false,
					} : {}),
				};

				const tsComplete = await getTsLs(tsLoc.lsType).doComplete(tsLoc.uri, tsLoc.range.start, options);
				if (!tsComplete)
					continue;

				if (tsComplete.isIncomplete) {
					result.isIncomplete = true;
				}

				if (inTemplate) {
					const sortTexts = getTsCompletions(ts)?.SortText;
					if (sortTexts) {
						tsComplete.items = tsComplete.items.filter(tsItem => {
							if (
								(sortTexts.GlobalsOrKeywords !== undefined && tsItem.sortText === sortTexts.GlobalsOrKeywords)
								|| (sortTexts.DeprecatedGlobalsOrKeywords !== undefined && tsItem.sortText === sortTexts.DeprecatedGlobalsOrKeywords)
							) {
								return isGloballyWhitelisted(tsItem.label);
							}
							return true;
						});
					}
				}
				const vueItems: vscode.CompletionItem[] = tsComplete.items.map(tsItem => {
					const vueItem = transformCompletionItem(
						tsItem,
						tsRange => {
							for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc.uri, tsRange.start, tsRange.end)) {
								return vueLoc.range;
							}
						},
					);
					const data: CompletionData = {
						lsType: tsLoc.lsType,
						uri: uri,
						docUri: tsLoc.uri,
						mode: 'ts',
						tsItem: tsItem,
					};
					// @ts-expect-error
					vueItem.data = data;
					return vueItem;
				});
				result.items = result.items.concat(vueItems);
			}
			if (result) {
				result.items = result.items.filter((result: vscode.CompletionItem) =>
					result.label.indexOf('__VLS_') === -1
					&& (!result.labelDetails?.description || result.labelDetails.description.indexOf('__VLS_') === -1)
				);
			}
			return result;
		}
		function getJsDocResult() {

			if (context?.triggerCharacter && !triggerCharacters.jsdoc.includes(context.triggerCharacter)) {
				return;
			}

			const result: vscode.CompletionList = vscode.CompletionList.create();

			for (const tsLoc of sourceFiles.toTsLocations(
				uri,
				position,
				position,
				data => !!data.capabilities.completion,
			)) {

				if (tsLoc.type === 'source-ts' && tsLoc.lsType !== 'script')
					continue;

				const jsDocComplete = getTsLs(tsLoc.lsType).doJsDocComplete(tsLoc.uri, tsLoc.range.start);
				if (jsDocComplete) {
					result.items.push(transformCompletionItem(
						jsDocComplete,
						tsRange => {
							for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc.uri, tsRange.start, tsRange.end)) {
								return vueLoc.range;
							}
						},
					));
				}
			}

			return result;
		}
		function getDirectiveCommentResult() {

			const result: vscode.CompletionList = vscode.CompletionList.create();

			for (const tsLoc of sourceFiles.toTsLocations(
				uri,
				position,
				position,
				data => !!data.capabilities.completion,
			)) {

				if (tsLoc.type === 'source-ts' && tsLoc.lsType !== 'script')
					continue;

				const commentComplete = getTsLs(tsLoc.lsType).doDirectiveCommentComplete(tsLoc.uri, tsLoc.range.start);
				if (commentComplete) {
					result.items = result.items.concat(commentComplete.map(item => transformCompletionItem(
						item,
						tsRange => {
							for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc.uri, tsRange.start, tsRange.end)) {
								return vueLoc.range;
							}
						},
					)));
				}
			}

			return result;
		}
		async function getHtmlResult(sourceFile: SourceFile) {
			let result: vscode.CompletionList | undefined = undefined;
			if (context?.triggerCharacter && !triggerCharacters.html.includes(context.triggerCharacter)) {
				return;
			}
			let nameCases = {
				tag: 'both' as 'both' | 'kebabCase' | 'pascalCase',
				attr: 'kebabCase' as 'kebabCase' | 'camelCase',
			};
			if (getNameCases) {
				const clientCases = await getNameCases(uri);
				nameCases.tag = clientCases.tagNameCase;
				nameCases.attr = clientCases.attrNameCase;
			}
			for (const sourceMap of sourceFile.getTemplateSourceMaps()) {

				const htmlDocument = getHtmlDocument(sourceMap.mappedDocument);
				const pugDocument = getPugDocument(sourceMap.mappedDocument);

				const componentCompletion = getComponentCompletionData(sourceFile);
				const tags: html.ITagData[] = [];
				const tsItems = new Map<string, vscode.CompletionItem>();
				const globalAttributes: html.IAttributeData[] = [
					{ name: 'v-if' },
					{ name: 'v-else-if' },
					{ name: 'v-else', valueSet: 'v' },
					{ name: 'v-for' },
				];

				const { contextItems } = sourceFile.getTemplateScriptData();
				for (const c of contextItems) {
					// @ts-expect-error
					const data: Data = c.data;
					const dir = hyphenate(data.name);
					if (dir.startsWith('v-')) {
						const key = 'dir:' + dir;
						globalAttributes.push({ name: dir, description: key });
						tsItems.set(key, c);
					}
				}

				for (const [_componentName, { item, bind, on }] of componentCompletion) {
					const componentNames =
						nameCases.tag === 'kebabCase'
							? new Set([hyphenate(_componentName)])
							: nameCases.tag === 'pascalCase'
								? new Set([_componentName])
								: new Set([hyphenate(_componentName), _componentName])
					for (const componentName of componentNames) {
						const attributes: html.IAttributeData[] = componentName === '*' ? globalAttributes : [];
						for (const prop of bind) {
							// @ts-expect-error
							const data: Data = prop.data;
							const name = nameCases.attr === 'camelCase' ? data.name : hyphenate(data.name);
							if (hyphenate(name).startsWith('on-')) {
								const propNameBase = name.startsWith('on-')
									? name.substr('on-'.length)
									: (name['on'.length].toLowerCase() + name.substr('onX'.length));
								const propKey = componentName + '@' + propNameBase;
								attributes.push(
									{
										name: 'v-on:' + propNameBase,
										description: propKey,
									},
									{
										name: '@' + propNameBase,
										description: propKey,
									},
								);
								tsItems.set(propKey, prop);
							}
							else {
								const propName = name;
								const propKey = componentName + ':' + propName;
								attributes.push(
									{
										name: propName,
										description: propKey,
									},
									{
										name: ':' + propName,
										description: propKey,
									},
									{
										name: 'v-bind:' + propName,
										description: propKey,
									},
								);
								tsItems.set(propKey, prop);
							}
						}
						for (const event of on) {
							// @ts-expect-error
							const data: Data = event.data;
							const name = nameCases.attr === 'camelCase' ? data.name : hyphenate(data.name);
							const propKey = componentName + '@' + name;
							attributes.push({
								name: 'v-on:' + name,
								description: propKey,
							});
							attributes.push({
								name: '@' + name,
								description: propKey,
							});
							tsItems.set(propKey, event);
						}
						if (componentName !== '*') {
							tags.push({
								name: componentName,
								description: componentName + ':',
								attributes,
							});
						}
						if (item) {
							tsItems.set(componentName + ':', item);
						}
					}
				}
				const descriptor = sourceFile.getDescriptor();
				const enabledComponentAutoImport = (isEnabledComponentAutoImport ? await isEnabledComponentAutoImport() : undefined) ?? true;
				if (enabledComponentAutoImport && (descriptor.script || descriptor.scriptSetup)) {
					for (const vueFile of sourceFiles.getAll()) {
						let baseName = path.basename(vueFile.uri, '.vue');
						if (baseName.toLowerCase() === 'index') {
							baseName = path.basename(path.dirname(vueFile.uri));
						}
						const componentName_1 = hyphenate(baseName);
						const componentName_2 = capitalize(camelize(baseName));
						let i: number | '' = '';
						if (componentCompletion.has(componentName_1) || componentCompletion.has(componentName_2)) {
							i = 1;
							while (componentCompletion.has(componentName_1 + i) || componentCompletion.has(componentName_2 + i)) {
								i++;
							}
						}
						tags.push({
							name: (nameCases.tag === 'kebabCase' ? componentName_1 : componentName_2) + i,
							description: vueFile.uri,
							attributes: [],
						});
					}
				}
				const dataProvider = html.newHTMLDataProvider(uri, {
					version: 1.1,
					tags,
					globalAttributes,
				});
				htmlLs.setDataProviders(true, [...getHtmlDataProviders(), dataProvider]);

				for (const [htmlRange] of sourceMap.getMappedRanges(position)) {
					if (!result) {
						result = {
							isIncomplete: false,
							items: [],
						};
					}
					const htmlResult =
						htmlDocument ? await htmlLs.doComplete2(sourceMap.mappedDocument, htmlRange.start, htmlDocument, documentContext)
							: pugDocument ? await pugLs.doComplete(pugDocument, htmlRange.start, documentContext)
								: undefined
					if (!htmlResult) continue;
					if (htmlResult.isIncomplete) {
						result.isIncomplete = true;
					}

					const replacement = getReplacement(htmlResult, sourceMap.mappedDocument);
					if (replacement) {
						const isEvent = replacement.text.startsWith('@') || replacement.text.startsWith('v-on:');
						const hasModifier = replacement.text.includes('.');
						if (isEvent && hasModifier) {
							const modifiers = replacement.text.split('.').slice(1);
							const textWithoutModifier = path.trimExt(replacement.text, [], 999);
							for (const modifier in eventModifiers) {
								if (modifiers.includes(modifier)) continue;
								const modifierDes = eventModifiers[modifier];
								const newItem: html.CompletionItem = {
									label: modifier,
									filterText: textWithoutModifier + '.' + modifier,
									documentation: modifierDes,
									textEdit: {
										range: replacement.textEdit.range,
										newText: textWithoutModifier + '.' + modifier,
									},
									kind: vscode.CompletionItemKind.EnumMember,
								};
								htmlResult.items.push(newItem);
							}
						}
					}

					let vueItems = htmlResult.items.map(htmlItem => transformCompletionItem(
						htmlItem,
						htmlRange => sourceMap.getSourceRange(htmlRange.start, htmlRange.end)?.[0],
					)) as vscode.CompletionItem[];
					const htmlItemsMap = new Map<string, vscode.CompletionItem>();
					for (const entry of htmlResult.items) {
						htmlItemsMap.set(entry.label, entry);
					}
					for (const vueItem of vueItems) {
						const documentation = typeof vueItem.documentation === 'string' ? vueItem.documentation : vueItem.documentation?.value;
						const importFile = documentation?.startsWith('file://') ? sourceFiles.get(documentation) : undefined;
						if (importFile) {
							const filePath = shared.uriToFsPath(importFile.uri);
							const rPath = path.relative(vueHost.getCurrentDirectory(), filePath);
							vueItem.documentation = undefined;
							vueItem.labelDetails = { description: rPath };
							vueItem.filterText = vueItem.label + ' ' + rPath;
							vueItem.detail = rPath;
							vueItem.kind = vscode.CompletionItemKind.File;
							vueItem.sortText = '\u0003' + vueItem.sortText;
							const data: CompletionData = {
								mode: 'autoImport',
								uri: uri,
								importUri: importFile.uri,
							};
							// @ts-expect-error
							vueItem.data = data;
						}
						else {
							const tsItem = documentation ? tsItems.get(documentation) : undefined;
							if (tsItem) {
								vueItem.documentation = undefined;
							}
							if (
								vueItem.label.startsWith(':')
								|| vueItem.label.startsWith('@')
								|| vueItem.label.startsWith('v-bind:')
								|| vueItem.label.startsWith('v-on:')
							) {
								if (!documentation?.startsWith('*:')) {
									vueItem.sortText = '\u0000' + vueItem.sortText;
								}
								if (tsItem) {
									if (vueItem.label.startsWith(':') || vueItem.label.startsWith('v-bind:')) {
										vueItem.kind = vscode.CompletionItemKind.Property;
									}
									else {
										vueItem.kind = vscode.CompletionItemKind.Event;
									}
								}
							}
							else if (
								vueItem.label === 'v-if'
								|| vueItem.label === 'v-else-if'
								|| vueItem.label === 'v-else'
								|| vueItem.label === 'v-for'
							) {
								vueItem.kind = vscode.CompletionItemKind.Method;
								vueItem.sortText = '\u0003' + vueItem.sortText;
							}
							else if (vueItem.label.startsWith('v-')) {
								vueItem.kind = vscode.CompletionItemKind.Function;
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
							// @ts-expect-error
							vueItem.data = data;
						}
					}
					{
						const temp = new Map<string, vscode.CompletionItem>();
						for (const item of vueItems) {
							// @ts-expect-error
							const data: CompletionData | undefined = item.data;
							if (data?.mode === 'autoImport' && data.importUri === sourceFile.uri) { // don't import itself
								continue;
							}
							if (!temp.get(item.label)?.documentation) { // filter HTMLAttributes
								temp.set(item.label, item);
							}
						}
						vueItems = [...temp.values()];
					}
					result.items = result.items.concat(vueItems);
				}

				htmlLs.setDataProviders(true, getHtmlDataProviders());
			}
			return result;
		}
		async function getCssResult(sourceFile: SourceFile) {
			let result: vscode.CompletionList | undefined = undefined;
			if (context?.triggerCharacter && !triggerCharacters.css.includes(context.triggerCharacter)) {
				return;
			}
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				for (const [cssRange] of sourceMap.getMappedRanges(position)) {

					if (!result) {
						result = {
							isIncomplete: false,
							items: [],
						};
					}
					const stylesheet = getStylesheet(sourceMap.mappedDocument);
					const cssLs = getCssLs(sourceMap.mappedDocument.languageId);

					if (!cssLs || !stylesheet)
						continue;

					const wordPattern = wordPatterns[sourceMap.mappedDocument.languageId] ?? wordPatterns.css;
					const wordStart = shared.getWordRange(wordPattern, cssRange.end, sourceMap.mappedDocument)?.start; // TODO: use end?
					const wordRange: vscode.Range = wordStart ? { start: wordStart, end: cssRange.end } : cssRange;
					const settings = await vueHost.getCssLanguageSettings?.(sourceMap.mappedDocument);
					const cssResult = await cssLs.doComplete2(sourceMap.mappedDocument, cssRange.start, stylesheet, documentContext, settings?.completion) as vscode.CompletionList;
					if (cssResult.isIncomplete) {
						result.isIncomplete = true;
					}
					const data: CompletionData = {
						uri: uri,
						docUri: sourceMap.mappedDocument.uri,
						mode: 'css',
					};
					const vueItems: vscode.CompletionItem[] = cssResult.items.map(cssItem => {
						if (!cssItem.textEdit) {
							const newText = cssItem.insertText || cssItem.label;
							cssItem.textEdit = vscode.TextEdit.replace(wordRange, newText);
						}
						const vueItem = transformCompletionItem(
							cssItem,
							cssRange => sourceMap.getSourceRange(cssRange.start, cssRange.end)?.[0],
						);
						// @ts-expect-error
						vueItem.data = data;
						return vueItem;
					});
					result.items = result.items.concat(vueItems);
				}
			}
			return result;
		}
		async function getJsonResult(sourceFile: SourceFile) {
			let result: vscode.CompletionList | undefined = undefined;
			if (context?.triggerCharacter && !triggerCharacters.json.includes(context.triggerCharacter)) {
				return;
			}
			for (const sourceMap of sourceFile.getCustomBlockSourceMaps()) {

				const jsonDocument = getJsonDocument(sourceMap.mappedDocument);
				if (!jsonDocument)
					continue;

				for (const [cssRange] of sourceMap.getMappedRanges(position)) {
					if (!result) {
						result = {
							isIncomplete: false,
							items: [],
						};
					}
					const jsonResult = await jsonLs.doComplete(sourceMap.mappedDocument, cssRange.start, jsonDocument);
					if (!jsonResult) continue;
					if (jsonResult.isIncomplete) {
						result.isIncomplete = true;
					}
					const vueItems: vscode.CompletionItem[] = jsonResult.items.map(jsonItem => {
						const vueItem = transformCompletionItem(
							jsonItem,
							jsonRange => sourceMap.getSourceRange(jsonRange.start, jsonRange.end)?.[0],
						);
						return vueItem;
					});
					result.items = result.items.concat(vueItems);
				}
			}
			return result;
		}
		async function getVueResult(sourceFile: SourceFile) {
			const embededDoc = getEmbeddedDoc(uri, { start: position, end: position });
			if (embededDoc) {
				let syntax = shared.languageIdToSyntax(embededDoc.language);
				if (syntax === 'vue') {
					const dataProvider = html.newHTMLDataProvider(uri, {
						version: 1.1,
						tags: vueTags,
					});
					htmlLs.setDataProviders(false, [dataProvider]);
					const result = await htmlLs.doComplete2(sourceFile.getTextDocument(), position, sourceFile.getVueHtmlDocument(), documentContext);
					htmlLs.setDataProviders(true, getHtmlDataProviders());
					return result;
				}
			}
		}
		async function getEmmetResult(sourceFile: SourceFile) {
			if (!vueHost.getEmmetConfig) return;
			const embededDoc = getEmbeddedDoc(uri, { start: position, end: position });
			if (embededDoc && !(embededDoc.sourceMap instanceof ScriptSourceMap && embededDoc.sourceMap.lsType === 'template')) {
				const emmetConfig = await vueHost.getEmmetConfig(embededDoc.language);
				if (emmetConfig) {
					let mode = emmet.getEmmetMode(embededDoc.language === 'vue' ? 'html' : embededDoc.language);
					if (!mode) return;
					const doc = embededDoc.document ?? sourceFile.getTextDocument();
					const emmetResult = emmet.doComplete(doc, embededDoc.range.start, mode, emmetConfig);
					if (emmetResult && embededDoc.sourceMap) {
						return transformCompletionList(
							emmetResult,
							emmetRange => embededDoc.sourceMap!.getSourceRange(emmetRange.start, emmetRange.end)?.[0],
						);
					}
					return emmetResult;
				}
			}
		}
	}

	function getComponentCompletionData(sourceFile: SourceFile) {
		let getter = componentCompletionDataGetters.get(sourceFile);
		if (!getter) {
			getter = untrack(useComponentCompletionData(sourceFile));
			componentCompletionDataGetters.set(sourceFile, getter);
		}
		return getter();
	}
	function useComponentCompletionData(sourceFile: SourceFile) {

		const {
			sfcTemplateScript,
			templateScriptData,
			sfcEntryForTemplateLs,
		} = sourceFile.refs;

		const projectVersion = ref<number>();
		const usedTags = ref(new Set<string>());
		const result = computed(() => {
			{ // watching
				projectVersion.value;
				usedTags.value;
			}
			const result = new Map<string, { item: vscode.CompletionItem | undefined, bind: vscode.CompletionItem[], on: vscode.CompletionItem[] }>();

			pauseTracking();
			const doc = sfcTemplateScript.textDocument.value;
			const templateTagNames = sfcTemplateScript.templateCodeGens.value ? Object.keys(sfcTemplateScript.templateCodeGens.value.tagNames) : [];
			const entryDoc = sfcEntryForTemplateLs.textDocument.value;
			resetTracking();

			if (doc && entryDoc) {

				const text = doc.getText();
				const tags_1 = templateScriptData.componentItems.map(item => {
					// @ts-expect-error
					const data: TsCompletionData = item.data;
					return { item, name: data.name };
				});
				const tags_2 = templateTagNames
					.filter(tag => tag.indexOf('.') >= 0)
					.map(tag => ({ name: tag, item: undefined }));

				for (const tag of [...tags_1, ...tags_2]) {

					if (result.has(tag.name))
						continue;

					let bind: vscode.CompletionItem[] = [];
					let on: vscode.CompletionItem[] = [];
					{
						const searchText = SearchTexts.PropsCompletion(tag.name);
						let offset = text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							bind = templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(offset))?.items ?? [];
						}
					}
					{
						const searchText = SearchTexts.EmitCompletion(tag.name);
						let offset = text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							on = templateTsLs.__internal__.doCompleteSync(doc.uri, doc.positionAt(offset))?.items ?? [];
						}
					}
					result.set(tag.name, { item: tag.item, bind, on });
				}
				const globalBind = templateTsLs.__internal__.doCompleteSync(entryDoc.uri, entryDoc.positionAt(entryDoc.getText().indexOf(SearchTexts.GlobalAttrs)))?.items ?? [];
				result.set('*', { item: undefined, bind: globalBind, on: [] });
			}
			return result;
		});
		return () => {
			projectVersion.value = getScriptContentVersion();
			const nowUsedTags = new Set(Object.keys(sfcTemplateScript.templateCodeGens.value?.tagNames ?? {}));
			if (!shared.eqSet(usedTags.value, nowUsedTags)) {
				usedTags.value = nowUsedTags;
			}
			return result.value;
		};
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

function getTsCompletions(ts: typeof import('typescript/lib/tsserverlibrary')): {
	StringCompletions: {
		getStringLiteralCompletions: Function,
		getStringLiteralCompletionDetails: Function,
	},
	moduleSpecifierResolutionLimit: 100,
	moduleSpecifierResolutionCacheAttemptLimit: 1000,
	SortText: {
		LocalDeclarationPriority: '10',
		LocationPriority: '11',
		OptionalMember: '12',
		MemberDeclaredBySpreadAssignment: '13',
		SuggestedClassMembers: '14',
		GlobalsOrKeywords: '15',
		AutoImportSuggestions: '16',
		JavascriptIdentifiers: '17',
		DeprecatedLocalDeclarationPriority: '18',
		DeprecatedLocationPriority: '19',
		DeprecatedOptionalMember: '20',
		DeprecatedMemberDeclaredBySpreadAssignment: '21',
		DeprecatedSuggestedClassMembers: '22',
		DeprecatedGlobalsOrKeywords: '23',
		DeprecatedAutoImportSuggestions: '24'
	},
	CompletionSource: { ThisProperty: 'ThisProperty/' },
	getCompletionsAtPosition: Function,
	getCompletionEntriesFromSymbols: Function,
	getCompletionEntryDetails: Function,
	createCompletionDetailsForSymbol: Function,
	createCompletionDetails: Function,
	getCompletionEntrySymbol: Function,
	CompletionKind: {
		'0': 'ObjectPropertyDeclaration',
		'1': 'Global',
		'2': 'PropertyAccess',
		'3': 'MemberLike',
		'4': 'String',
		'5': 'None',
		ObjectPropertyDeclaration: 0,
		Global: 1,
		PropertyAccess: 2,
		MemberLike: 3,
		String: 4,
		None: 5
	},
	getPropertiesForObjectExpression: Function,
} | undefined {
	return (ts as any).Completions;
}
