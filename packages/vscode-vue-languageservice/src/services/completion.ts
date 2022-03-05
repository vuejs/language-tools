import * as shared from '@volar/shared';
import { transformCompletionItem } from '@volar/transforms';
import { computed, pauseTracking, resetTracking, ref } from '@vue/reactivity';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import * as path from 'upath';
import * as html from 'vscode-html-languageservice';
import * as ts2 from 'vscode-typescript-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Data } from 'vscode-typescript-languageservice/src/services/completion';
import { SourceFile } from '@volar/vue-typescript';
import type { LanguageServiceRuntimeContext } from '../types';
import { untrack } from '../utils/untrack';
import { SearchTexts } from '@volar/vue-typescript';
import { visitEmbedded } from '../plugins/definePlugin';
import { LanguageServicePlugin } from '../languageService';

// https://v3.vuejs.org/api/directives.html#v-on
const eventModifiers: Record<string, string> = {
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

const vueGlobalDirectiveProvider = html.newHTMLDataProvider('vueGlobalDirective', {
	version: 1.1,
	tags: [],
	globalAttributes: [
		{ name: 'v-if' },
		{ name: 'v-else-if' },
		{ name: 'v-else', valueSet: 'v' },
		{ name: 'v-for' },
	],
});

export interface PluginCompletionData {
	mode: 'plugin',
	uri: string,
	originalItem: vscode.CompletionItem,
	pluginId: number,
	sourceMapId: number | undefined,
	embeddedDocumentUri: string | undefined,
}

export interface HtmlCompletionData {
	mode: 'html',
	uri: string,
	tsItem: vscode.CompletionItem | undefined,
}

export interface AutoImportCompletionData {
	mode: 'autoImport',
	uri: string,
	importUri: string,
}

export type CompletionData = PluginCompletionData | HtmlCompletionData | AutoImportCompletionData;

export function register(
	{ sourceFiles, htmlLs, vueHost, templateTsLs, getHtmlDataProviders, getPlugins, getTextDocument }: LanguageServiceRuntimeContext,
	getScriptContentVersion: () => number,
) {

	let cache: {
		uri: string,
		data: {
			sourceMapId: number | undefined,
			embeddedDocumentUri: string | undefined,
			plugin: LanguageServicePlugin,
			list: vscode.CompletionList,
		}[],
		hasMainCompletion: boolean,
	} | undefined;
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

		const document = getTextDocument(uri)

		if (
			context?.triggerKind === vscode.CompletionTriggerKind.TriggerForIncompleteCompletions
			&& cache?.uri === uri
		) {

			for (const cacheData of cache.data) {

				if (!cacheData.list.isIncomplete)
					continue;

				if (cacheData.sourceMapId !== undefined && cacheData.embeddedDocumentUri !== undefined) {

					const sourceMap = sourceFiles.getSourceMap(cacheData.sourceMapId, cacheData.embeddedDocumentUri);

					if (!sourceMap)
						continue;

					for (const [embeddedRange] of sourceMap.getMappedRanges(position, position, data => !!data.capabilities.completion)) {

						if (!cacheData.plugin.doComplete)
							continue;

						const embeddedCompletionList = await cacheData.plugin.doComplete(sourceMap.mappedDocument, embeddedRange.start, context);

						if (!embeddedCompletionList)
							continue;

						cacheData.list = {
							...embeddedCompletionList,
							items: embeddedCompletionList.items.map(item => ({
								...transformCompletionItem(
									item,
									embeddedRange => sourceMap.getSourceRange(embeddedRange.start, embeddedRange.end)?.[0],
								),
								data: <PluginCompletionData>{
									uri,
									originalItem: item,
									pluginId: cacheData.plugin.id,
									sourceMapId: sourceMap.id,
									embeddedDocumentUri: sourceMap.mappedDocument.uri,
								} as any,
							})),
						};
					}
				}

				if (document) {

					if (!cacheData.plugin.doComplete)
						continue;

					const completionList = await cacheData.plugin.doComplete(document, position, context);

					if (!completionList)
						continue;

					cacheData.list = {
						...completionList,
						items: completionList.items.map(item => ({
							...item,
							data: <PluginCompletionData>{
								mode: 'plugin',
								uri,
								originalItem: item,
								pluginId: cacheData.plugin.id,
								sourceMapId: undefined,
								embeddedDocumentUri: undefined,
							} as any,
						}))
					};
				}
			}
		}
		else {

			const vueDocument = sourceFiles.get(uri);

			cache = {
				uri,
				data: [],
				hasMainCompletion: false,
			};

			if (vueDocument) {

				const embeddeds = vueDocument.getEmbeddeds();

				await visitEmbedded(embeddeds, async sourceMap => {

					const plugins = getPlugins(sourceMap.lsType);

					for (const [embeddedRange] of sourceMap.getMappedRanges(position, position, data => !!data.capabilities.completion)) {

						for (const plugin of plugins) {

							if (!plugin.doComplete)
								continue;

							if (context?.triggerCharacter && !plugin.context?.triggerCharacters?.includes(context.triggerCharacter))
								continue;

							if (cache!.hasMainCompletion && !plugin.context?.isAdditionalCompletion)
								continue;

							let htmlTsItems: Awaited<ReturnType<typeof provideHtmlData>> | undefined;

							if (plugin.context?.useHtmlLs) {
								htmlTsItems = await provideHtmlData(vueDocument);
							}

							const embeddedCompletionList = await plugin.doComplete(sourceMap.mappedDocument, embeddedRange.start, context);

							if (!embeddedCompletionList)
								continue;

							if (!plugin.context?.isAdditionalCompletion) {
								cache!.hasMainCompletion = true;
							}

							const completionList: vscode.CompletionList = {
								...embeddedCompletionList,
								items: embeddedCompletionList.items.map(item => ({
									...transformCompletionItem(
										item,
										embeddedRange => sourceMap.getSourceRange(embeddedRange.start, embeddedRange.end)?.[0],
									),
									data: <PluginCompletionData>{
										mode: 'plugin',
										uri,
										originalItem: item,
										pluginId: plugin.id,
										sourceMapId: sourceMap.id,
										embeddedDocumentUri: sourceMap.mappedDocument.uri,
									} as any,
								})),
							};

							if (htmlTsItems) {
								afterHtmlCompletion(completionList, vueDocument, htmlTsItems)
							}

							cache!.data.push({
								sourceMapId: sourceMap.id,
								embeddedDocumentUri: sourceMap.mappedDocument.uri,
								plugin,
								list: completionList,
							});
						}
					}

					return true;
				});
			}

			if (document) {

				const plugins = getPlugins('script');

				for (const plugin of plugins) {

					if (!plugin.doComplete)
						continue;

					if (context?.triggerCharacter && !plugin.context?.triggerCharacters?.includes(context.triggerCharacter))
						continue;

					if (cache.hasMainCompletion && !plugin.context?.isAdditionalCompletion)
						continue;

					const completionList = await plugin.doComplete(document, position, context);

					if (!completionList)
						continue;

					if (!plugin.context?.isAdditionalCompletion) {
						cache.hasMainCompletion = true;
					}

					cache.data.push({
						sourceMapId: undefined,
						embeddedDocumentUri: undefined,
						plugin,
						list: {
							...completionList,
							items: completionList.items.map(item => ({
								...item,
								data: <PluginCompletionData>{
									mode: 'plugin',
									uri,
									originalItem: item,
									pluginId: plugin.id,
									sourceMapId: undefined,
									embeddedDocumentUri: undefined,
								} as any,
							}))
						},
					});
				}
			}
		}

		return combineCompletionList(cache.data.map(cacheData => cacheData.list));

		function combineCompletionList(lists: vscode.CompletionList[]) {
			return {
				isIncomplete: lists.some(list => list.isIncomplete),
				items: lists.map(list => list.items).flat().filter((result: vscode.CompletionItem) =>
					result.label.indexOf('__VLS_') === -1
					&& (!result.labelDetails?.description || result.labelDetails.description.indexOf('__VLS_') === -1)
				),
			};
		}

		async function provideHtmlData(vueDocument: SourceFile) {

			let nameCases = {
				tag: 'both' as 'both' | 'kebabCase' | 'pascalCase',
				attr: 'kebabCase' as 'kebabCase' | 'camelCase',
			};

			if (getNameCases) {
				const clientCases = await getNameCases(uri);
				nameCases.tag = clientCases.tagNameCase;
				nameCases.attr = clientCases.attrNameCase;
			}

			const componentCompletion = getComponentCompletionData(vueDocument);
			const tags: html.ITagData[] = [];
			const tsItems = new Map<string, vscode.CompletionItem>();
			const globalAttributes: html.IAttributeData[] = [];
			const { contextItems } = vueDocument.getTemplateScriptData();

			for (const item of contextItems) {
				// @ts-expect-error
				const data: Data = item.data;
				const dir = hyphenate(data.name);
				if (dir.startsWith('v-')) {
					const key = createInternalItemId('vueDirective', [dir]);
					globalAttributes.push({ name: dir, description: key });
					tsItems.set(key, item);
				}
			}

			for (const [_componentName, { item, bind, on }] of componentCompletion) {

				const componentNames =
					nameCases.tag === 'kebabCase' ? new Set([hyphenate(_componentName)])
						: nameCases.tag === 'pascalCase' ? new Set([_componentName])
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
							const propKey = createInternalItemId('componentEvent', [componentName, propNameBase]);

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
							const propKey = createInternalItemId('componentProp', [componentName, propName]);

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
						const propKey = createInternalItemId('componentEvent', [componentName, name]);

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

					const componentKey = createInternalItemId('component', [componentName])

					if (componentName !== '*') {
						tags.push({
							name: componentName,
							description: componentKey,
							attributes,
						});
					}

					if (item) {
						tsItems.set(componentKey, item);
					}
				}
			}

			const descriptor = vueDocument.getDescriptor();
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
						description: createInternalItemId('importFile', [vueFile.uri]),
						attributes: [],
					});
				}
			}

			const dataProvider = html.newHTMLDataProvider(uri, {
				version: 1.1,
				tags,
				globalAttributes,
			});

			htmlLs.setDataProviders(true, [
				...getHtmlDataProviders(),
				vueGlobalDirectiveProvider,
				dataProvider,
			]);

			return tsItems;
		}

		function afterHtmlCompletion(completionList: vscode.CompletionList, vueDocument: SourceFile, tsItems: Map<string, vscode.CompletionItem>) {

			const replacement = getReplacement(completionList, vueDocument.getTextDocument());

			if (replacement) {

				const isEvent = replacement.text.startsWith('@') || replacement.text.startsWith('v-on:');
				const hasModifier = replacement.text.includes('.');

				if (isEvent && hasModifier) {

					const modifiers = replacement.text.split('.').slice(1);
					const textWithoutModifier = path.trimExt(replacement.text, [], 999);

					for (const modifier in eventModifiers) {

						if (modifiers.includes(modifier))
							continue;

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

						completionList.items.push(newItem);
					}
				}
			}

			for (const item of completionList.items) {

				const itemIdKey = typeof item.documentation === 'string' ? item.documentation : item.documentation?.value;
				const itemId = itemIdKey ? readInternalItemId(itemIdKey) : undefined;

				if (itemId) {
					item.documentation = undefined;
				}

				if (itemId?.type === 'importFile') {

					const [fileUri] = itemId.args;
					const filePath = shared.uriToFsPath(fileUri);
					const rPath = path.relative(vueHost.getCurrentDirectory(), filePath);
					item.labelDetails = { description: rPath };
					item.filterText = item.label + ' ' + rPath;
					item.detail = rPath;
					item.kind = vscode.CompletionItemKind.File;
					item.sortText = '\u0003' + item.sortText;
					item.data = <AutoImportCompletionData>{
						mode: 'autoImport',
						uri: uri,
						importUri: fileUri,
					} as any;
				}
				else if (itemIdKey && itemId) {

					const tsItem = itemIdKey ? tsItems.get(itemIdKey) : undefined;

					if (itemId.type === 'componentProp' || itemId.type === 'componentEvent') {

						const [componentName] = itemId.args;

						if (componentName !== '*') {
							item.sortText = '\u0000' + item.sortText;
						}

						if (tsItem) {
							if (itemId.type === 'componentProp') {
								item.kind = vscode.CompletionItemKind.Property;
							}
							else {
								item.kind = vscode.CompletionItemKind.Event;
							}
						}
					}
					else if (
						item.label === 'v-if'
						|| item.label === 'v-else-if'
						|| item.label === 'v-else'
						|| item.label === 'v-for'
					) {
						item.kind = vscode.CompletionItemKind.Method;
						item.sortText = '\u0003' + item.sortText;
					}
					else if (item.label.startsWith('v-')) {
						item.kind = vscode.CompletionItemKind.Function;
						item.sortText = '\u0002' + item.sortText;
					}
					else {
						item.sortText = '\u0001' + item.sortText;
					}

					item.data = <HtmlCompletionData>{
						mode: 'html',
						uri,
						tsItem: tsItem,
					} as any;
				}
			}

			{
				const temp = new Map<string, vscode.CompletionItem>();

				for (const item of completionList.items) {

					const data: CompletionData | undefined = item.data as any;

					if (data?.mode === 'autoImport' && data.importUri === vueDocument.uri) { // don't import itself
						continue;
					}

					if (!temp.get(item.label)?.documentation) { // filter HTMLAttributes
						temp.set(item.label, item);
					}
				}

				completionList.items = [...temp.values()];
			}

			htmlLs.setDataProviders(true, getHtmlDataProviders());
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

function createInternalItemId(type: 'importFile' | 'vueDirective' | 'componentEvent' | 'componentProp' | 'component', args: string[]) {
	return '__VLS_::' + type + '::' + args.join(',');
}

function readInternalItemId(key: string) {
	if (key.startsWith('__VLS_::')) {
		const strs = key.split('::');
		return {
			type: strs[1] as 'importFile' | 'vueDirective' | 'componentEvent' | 'componentProp' | 'component',
			args: strs[2].split(','),
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

export function getTsCompletions(ts: typeof import('typescript/lib/tsserverlibrary')): {
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
