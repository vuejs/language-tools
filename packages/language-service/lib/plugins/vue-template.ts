import type {
	CompletionItemKind,
	CompletionItemTag,
	CompletionList,
	Disposable,
	LanguageServicePlugin,
	TextDocument,
} from '@volar/language-service';
import { hyphenateAttr, hyphenateTag, tsCodegen, type VueVirtualCode } from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import type { ComponentPropInfo } from '@vue/typescript-plugin/lib/requests/getComponentProps';
import { create as createHtmlService } from 'volar-service-html';
import { create as createPugService } from 'volar-service-pug';
import * as html from 'vscode-html-languageservice';
import { URI, Utils } from 'vscode-uri';
import { loadModelModifiersData, loadTemplateData } from '../data';
import { AttrNameCasing, checkCasing, TagNameCasing } from '../nameCasing';
import { resolveEmbeddedCode } from '../utils';

const specialTags = new Set([
	'slot',
	'component',
	'template',
]);

const specialProps = new Set([
	'class',
	'data-allow-mismatch',
	'is',
	'key',
	'ref',
	'style',
]);

let builtInData: html.HTMLDataV1 | undefined;
let modelData: html.HTMLDataV1 | undefined;

export function create(
	languageId: 'html' | 'jade',
	{
		getComponentNames,
		getElementAttrs,
		getComponentProps,
		getComponentEvents,
		getComponentDirectives,
		getComponentSlots,
	}: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	let customData: html.IHTMLDataProvider[] = [];
	let extraCustomData: html.IHTMLDataProvider[] = [];

	const onDidChangeCustomDataListeners = new Set<() => void>();
	const onDidChangeCustomData = (listener: () => void): Disposable => {
		onDidChangeCustomDataListeners.add(listener);
		return {
			dispose() {
				onDidChangeCustomDataListeners.delete(listener);
			},
		};
	};
	const baseService = languageId === 'jade'
		? createPugService({
			useDefaultDataProvider: false,
			getCustomData() {
				return [
					...customData,
					...extraCustomData,
				];
			},
			onDidChangeCustomData,
		})
		: createHtmlService({
			documentSelector: ['html', 'markdown'],
			useDefaultDataProvider: false,
			getCustomData() {
				return [
					...customData,
					...extraCustomData,
				];
			},
			onDidChangeCustomData,
		});
	const htmlDataProvider = html.getDefaultHTMLDataProvider();

	return {
		name: `vue-template (${languageId})`,
		capabilities: {
			...baseService.capabilities,
			completionProvider: {
				triggerCharacters: [
					...baseService.capabilities.completionProvider?.triggerCharacters ?? [],
					'@', // vue event shorthand
				],
			},
			hoverProvider: true,
		},
		create(context) {
			const baseServiceInstance = baseService.create(context);

			builtInData ??= loadTemplateData(context.env.locale ?? 'en');
			modelData ??= loadModelModifiersData(context.env.locale ?? 'en');

			// https://vuejs.org/api/built-in-directives.html#v-on
			// https://vuejs.org/api/built-in-directives.html#v-bind
			const vOnModifiers: Record<string, string> = {};
			const vBindModifiers: Record<string, string> = {};
			const vModelModifiers: Record<string, string> = {};
			const vOn = builtInData.globalAttributes?.find(x => x.name === 'v-on');
			const vBind = builtInData.globalAttributes?.find(x => x.name === 'v-bind');
			const vModel = builtInData.globalAttributes?.find(x => x.name === 'v-model');

			if (vOn) {
				const markdown = typeof vOn.description === 'object'
					? vOn.description.value
					: vOn.description ?? '';
				const modifiers = markdown
					.split('\n- ')[4]!
					.split('\n').slice(2, -1);
				for (let text of modifiers) {
					text = text.slice('  - `.'.length);
					const [name, desc] = text.split('` - ') as [string, string];
					vOnModifiers[name] = desc;
				}
			}
			if (vBind) {
				const markdown = typeof vBind.description === 'object'
					? vBind.description.value
					: vBind.description ?? '';
				const modifiers = markdown
					.split('\n- ')[4]!
					.split('\n').slice(2, -1);
				for (let text of modifiers) {
					text = text.slice('  - `.'.length);
					const [name, desc] = text.split('` - ') as [string, string];
					vBindModifiers[name] = desc;
				}
			}
			if (vModel) {
				for (const modifier of modelData.globalAttributes ?? []) {
					const description = typeof modifier.description === 'object'
						? modifier.description.value
						: modifier.description ?? '';
					const references = modifier.references?.map(ref => `[${ref.name}](${ref.url})`).join(' | ');
					vModelModifiers[modifier.name] = description + '\n\n' + references;
				}
			}

			const disposable = context.env.onDidChangeConfiguration?.(() => initializing = undefined);

			let initializing: Promise<void> | undefined;

			return {
				...baseServiceInstance,

				dispose() {
					baseServiceInstance.dispose?.();
					disposable?.dispose();
				},

				async provideCompletionItems(document, position, completionContext, token) {
					if (document.languageId !== languageId) {
						return;
					}
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}

					const {
						result: completionList,
						target,
						info: {
							components,
							propMap,
						},
					} = await runWithVueData(
						info.script.id,
						info.root,
						() =>
							baseServiceInstance.provideCompletionItems!(
								document,
								position,
								completionContext,
								token,
							),
					);

					if (!completionList) {
						return;
					}

					switch (target) {
						case 'tag': {
							completionList.items.forEach(transformTag);
							break;
						}
						case 'attribute': {
							addDirectiveModifiers(completionList, document);
							completionList.items.forEach(transformAttribute);
							break;
						}
					}

					updateExtraCustomData([]);
					return completionList;

					function transformTag(item: html.CompletionItem) {
						const tagName = capitalize(camelize(item.label));
						if (components?.includes(tagName)) {
							item.kind = 6 satisfies typeof CompletionItemKind.Variable;
							item.sortText = '\u0000' + (item.sortText ?? item.label);
						}
					}

					function transformAttribute(item: html.CompletionItem) {
						let prop = propMap.get(item.label);

						if (prop) {
							if (prop.info?.documentation) {
								item.documentation = {
									kind: 'markdown',
									value: prop.info.documentation,
								};
							}
							if (prop.info?.deprecated) {
								item.tags = [1 satisfies typeof CompletionItemTag.Deprecated];
							}
						}
						else {
							let name = item.label;
							for (const str of ['v-bind:', ':']) {
								if (name.startsWith(str) && name !== str) {
									name = name.slice(str.length);
									break;
								}
							}
							if (specialProps.has(name)) {
								prop = {
									name,
									kind: 'prop',
								};
							}
						}

						const tokens: string[] = [];

						if (prop) {
							const { isEvent, propName } = getPropName(prop.name, prop.kind === 'event');

							if (prop.kind === 'prop') {
								if (!prop.isGlobal) {
									item.kind = 5 satisfies typeof CompletionItemKind.Field;
								}
							}
							else if (isEvent) {
								item.kind = 23 satisfies typeof CompletionItemKind.Event;
								if (propName.startsWith('vue:')) {
									tokens.push('\u0004');
								}
							}

							if (!prop.isGlobal) {
								tokens.push('\u0000');

								if (item.label.startsWith(':')) {
									tokens.push('\u0001');
								}
								else if (item.label.startsWith('@')) {
									tokens.push('\u0002');
								}
								else if (item.label.startsWith('v-bind:')) {
									tokens.push('\u0003');
								}
								else if (item.label.startsWith('v-model:')) {
									tokens.push('\u0004');
								}
								else if (item.label.startsWith('v-on:')) {
									tokens.push('\u0005');
								}
								else {
									tokens.push('\u0000');
								}

								if (specialProps.has(propName)) {
									tokens.push('\u0001');
								}
								else {
									tokens.push('\u0000');
								}
							}
						}
						else if (
							item.label === 'v-if'
							|| item.label === 'v-else-if'
							|| item.label === 'v-else'
							|| item.label === 'v-for'
						) {
							item.kind = 14 satisfies typeof CompletionItemKind.Keyword;
							tokens.push('\u0003');
						}
						else if (item.label.startsWith('v-')) {
							item.kind = 3 satisfies typeof CompletionItemKind.Function;
							tokens.push('\u0002');
						}
						else {
							tokens.push('\u0001');
						}

						item.sortText = tokens.join('') + (item.sortText ?? item.label);

						if (item.label === 'v-for') {
							item.textEdit!.newText = item.label + '="${1:value} in ${2:source}"';
						}
					}
				},

				provideHover(document, position, token) {
					if (document.languageId !== languageId) {
						return;
					}
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}

					if (context.decodeEmbeddedDocumentUri(URI.parse(document.uri))) {
						updateExtraCustomData([
							htmlDataProvider,
						]);
					}

					return baseServiceInstance.provideHover?.(document, position, token);
				},
			};

			async function runWithVueData<T>(sourceDocumentUri: URI, root: VueVirtualCode, fn: () => T) {
				// #4298: Precompute HTMLDocument before provideHtmlData to avoid parseHTMLDocument requesting component names from tsserver
				await fn();

				const { sync } = await provideHtmlData(sourceDocumentUri, root);
				let lastSync = await sync();
				let result = await fn();
				while (lastSync.version !== (lastSync = await sync()).version) {
					result = await fn();
				}
				return { result, ...lastSync };
			}

			async function provideHtmlData(sourceDocumentUri: URI, root: VueVirtualCode) {
				await (initializing ??= initialize());

				const casing = await checkCasing(context, sourceDocumentUri);

				for (const tag of builtInData!.tags ?? []) {
					if (specialTags.has(tag.name)) {
						continue;
					}
					if (casing.tag === TagNameCasing.Kebab) {
						tag.name = hyphenateTag(tag.name);
					}
					else {
						tag.name = camelize(capitalize(tag.name));
					}
				}

				let version = 0;
				let target: 'tag' | 'attribute' | 'value';
				let components: string[] | undefined;
				let values: string[] | undefined;

				const tasks: Promise<void>[] = [];
				const tagMap = new Map<string, {
					attrs: string[];
					propInfos: ComponentPropInfo[];
					events: string[];
					directives: string[];
				}>();
				const propMap = new Map<string, {
					name: string;
					kind: 'prop' | 'event';
					isGlobal?: boolean;
					info?: ComponentPropInfo;
				}>();

				updateExtraCustomData([
					{
						getId: () => htmlDataProvider.getId(),
						isApplicable: () => true,
						provideTags() {
							target = 'tag';
							return htmlDataProvider.provideTags()
								.filter(tag => !specialTags.has(tag.name));
						},
						provideAttributes(tag) {
							target = 'attribute';
							const attrs = htmlDataProvider.provideAttributes(tag);
							if (tag === 'slot') {
								const nameAttr = attrs.find(attr => attr.name === 'name');
								if (nameAttr) {
									nameAttr.valueSet = 'slot';
								}
							}
							return attrs;
						},
						provideValues(tag, attr) {
							target = 'value';
							return htmlDataProvider.provideValues(tag, attr);
						},
					},
					html.newHTMLDataProvider('vue-template-built-in', builtInData!),
					{
						getId: () => 'vue-template',
						isApplicable: () => true,
						provideTags: () => {
							if (!components) {
								components = [];
								tasks.push((async () => {
									components = (await getComponentNames(root.fileName) ?? [])
										.filter(name =>
											name !== 'Transition'
											&& name !== 'TransitionGroup'
											&& name !== 'KeepAlive'
											&& name !== 'Suspense'
											&& name !== 'Teleport'
										);
									version++;
								})());
							}
							const scriptSetupRanges = tsCodegen.get(root.sfc)?.getScriptSetupRanges();
							const names = new Set<string>();
							const tags: html.ITagData[] = [];

							for (const tag of components) {
								if (casing.tag === TagNameCasing.Kebab) {
									names.add(hyphenateTag(tag));
								}
								else {
									names.add(tag);
								}
							}

							for (const binding of scriptSetupRanges?.bindings ?? []) {
								const name = root.sfc.scriptSetup!.content.slice(binding.range.start, binding.range.end);
								if (casing.tag === TagNameCasing.Kebab) {
									names.add(hyphenateTag(name));
								}
								else {
									names.add(name);
								}
							}

							for (const name of names) {
								tags.push({
									name: name,
									attributes: [],
								});
							}

							return tags;
						},
						provideAttributes: tag => {
							let tagInfo = tagMap.get(tag);
							if (!tagInfo) {
								tagInfo = {
									attrs: [],
									propInfos: [],
									events: [],
									directives: [],
								};
								tagMap.set(tag, tagInfo);
								tasks.push((async () => {
									tagMap.set(tag, {
										attrs: await getElementAttrs(root.fileName, tag) ?? [],
										propInfos: await getComponentProps(root.fileName, tag) ?? [],
										events: await getComponentEvents(root.fileName, tag) ?? [],
										directives: await getComponentDirectives(root.fileName) ?? [],
									});
									version++;
								})());
							}

							const { attrs, propInfos, events, directives } = tagInfo;

							for (let i = 0; i < propInfos.length; i++) {
								const prop = propInfos[i]!;
								if (prop.name.startsWith('ref_')) {
									propInfos.splice(i--, 1);
									continue;
								}
								if (hyphenateTag(prop.name).startsWith('on-vnode-')) {
									prop.name = 'onVue:' + prop.name['onVnode'.length]!.toLowerCase()
										+ prop.name.slice('onVnodeX'.length);
								}
							}

							const attributes: html.IAttributeData[] = [];
							const propNameSet = new Set(propInfos.map(prop => prop.name));

							for (
								const prop of [
									...propInfos,
									...attrs.map<ComponentPropInfo>(attr => ({ name: attr })),
								]
							) {
								const isGlobal = prop.isAttribute || !propNameSet.has(prop.name);
								const propName = casing.attr === AttrNameCasing.Camel ? prop.name : hyphenateAttr(prop.name);
								const isEvent = hyphenateAttr(propName).startsWith('on-');

								if (isEvent) {
									const eventName = casing.attr === AttrNameCasing.Camel
										? propName['on'.length]!.toLowerCase() + propName.slice('onX'.length)
										: propName.slice('on-'.length);

									for (
										const name of [
											'v-on:' + eventName,
											'@' + eventName,
										]
									) {
										attributes.push({ name });
										propMap.set(name, {
											name: propName,
											kind: 'event',
											isGlobal,
											info: prop,
										});
									}
								}
								else {
									const propInfo = propInfos.find(prop => {
										const name = casing.attr === AttrNameCasing.Camel ? prop.name : hyphenateAttr(prop.name);
										return name === propName;
									});

									for (
										const name of [
											propName,
											':' + propName,
											'v-bind:' + propName,
										]
									) {
										attributes.push({
											name,
											valueSet: prop.values?.some(value => typeof value === 'string') ? '__deferred__' : undefined,
										});
										propMap.set(name, {
											name: propName,
											kind: 'prop',
											isGlobal,
											info: propInfo,
										});
									}
								}
							}

							for (const event of events) {
								const eventName = casing.attr === AttrNameCasing.Camel ? event : hyphenateAttr(event);

								for (
									const name of [
										'v-on:' + eventName,
										'@' + eventName,
									]
								) {
									attributes.push({ name });
									propMap.set(name, {
										name: eventName,
										kind: 'event',
									});
								}
							}

							for (const directive of directives) {
								const name = hyphenateAttr(directive);
								attributes.push({
									name,
								});
							}

							const models: string[] = [];

							for (
								const prop of [
									...propInfos,
									...attrs.map(attr => ({ name: attr })),
								]
							) {
								if (prop.name.startsWith('onUpdate:')) {
									models.push(prop.name.slice('onUpdate:'.length));
								}
							}
							for (const event of events) {
								if (event.startsWith('update:')) {
									models.push(event.slice('update:'.length));
								}
							}

							for (const model of models) {
								const name = casing.attr === AttrNameCasing.Camel ? model : hyphenateAttr(model);

								attributes.push({ name: 'v-model:' + name });
								propMap.set('v-model:' + name, {
									name,
									kind: 'prop',
								});

								if (model === 'modelValue') {
									propMap.set('v-model', {
										name,
										kind: 'prop',
									});
								}
							}

							return attributes;
						},
						provideValues: (tag, attr) => {
							if (!values) {
								values = [];
								tasks.push((async () => {
									if (tag === 'slot' && attr === 'name') {
										values = await getComponentSlots(root.fileName) ?? [];
									}
									version++;
								})());
							}
							return values.map(value => ({
								name: value,
							}));
						},
					},
				]);

				return {
					async sync() {
						await Promise.all(tasks);
						return {
							version,
							target,
							info: {
								components,
								propMap,
							},
						};
					},
				};
			}

			function addDirectiveModifiers(completionList: CompletionList, document: TextDocument) {
				const replacement = getReplacement(completionList, document);
				if (!replacement?.text.includes('.')) {
					return;
				}

				const [text, ...modifiers] = replacement.text.split('.') as [string, ...string[]];
				const isVOn = text.startsWith('v-on:') || text.startsWith('@') && text.length > 1;
				const isVBind = text.startsWith('v-bind:') || text.startsWith(':') && text.length > 1;
				const isVModel = text.startsWith('v-model:') || text === 'v-model';
				const currentModifiers = isVOn
					? vOnModifiers
					: isVBind
					? vBindModifiers
					: isVModel
					? vModelModifiers
					: undefined;

				if (!currentModifiers) {
					return;
				}

				for (const modifier in currentModifiers) {
					if (modifiers.includes(modifier)) {
						continue;
					}

					const description = currentModifiers[modifier]!;
					const insertText = text + modifiers.slice(0, -1).map(m => '.' + m).join('') + '.' + modifier;
					const newItem: html.CompletionItem = {
						label: modifier,
						filterText: insertText,
						documentation: {
							kind: 'markdown',
							value: description,
						},
						textEdit: {
							range: replacement.textEdit.range,
							newText: insertText,
						},
						kind: 20 satisfies typeof CompletionItemKind.EnumMember,
					};

					completionList.items.push(newItem);
				}
			}

			async function initialize() {
				customData = await getHtmlCustomData();
			}

			async function getHtmlCustomData() {
				const customData: string[] = await context.env.getConfiguration?.('html.customData') ?? [];
				const newData: html.IHTMLDataProvider[] = [];
				for (const customDataPath of customData) {
					for (const workspaceFolder of context.env.workspaceFolders) {
						const uri = Utils.resolvePath(workspaceFolder, customDataPath);
						const json = await context.env.fs?.readFile(uri);
						if (json) {
							try {
								const data = JSON.parse(json);
								newData.push(html.newHTMLDataProvider(customDataPath, data));
							}
							catch (error) {
								console.error(error);
							}
						}
					}
				}
				return newData;
			}
		},
	};

	function updateExtraCustomData(extraData: html.IHTMLDataProvider[]) {
		extraCustomData = extraData;
		onDidChangeCustomDataListeners.forEach(l => l());
	}
}

function getReplacement(list: html.CompletionList, doc: TextDocument) {
	for (const item of list.items) {
		if (item.textEdit && 'range' in item.textEdit) {
			return {
				item: item,
				textEdit: item.textEdit,
				text: doc.getText(item.textEdit.range),
			};
		}
	}
}

function getPropName(
	prop: string,
	isEvent: boolean,
) {
	const name = hyphenateAttr(prop);
	if (name.startsWith('on-')) {
		return { isEvent: true, propName: name.slice('on-'.length) };
	}
	return { isEvent, propName: name };
}
