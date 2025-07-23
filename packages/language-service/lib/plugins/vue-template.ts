import type {
	CompletionItemKind,
	CompletionItemTag,
	CompletionList,
	Disposable,
	LanguageServiceContext,
	LanguageServicePlugin,
	TextDocument,
} from '@volar/language-service';
import { hyphenateAttr, hyphenateTag, tsCodegen, VueVirtualCode } from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import type { ComponentPropInfo } from '@vue/typescript-plugin/lib/requests/getComponentProps';
import { create as createHtmlService } from 'volar-service-html';
import { create as createPugService } from 'volar-service-pug';
import * as html from 'vscode-html-languageservice';
import { URI, Utils } from 'vscode-uri';
import { AttrNameCasing, checkCasing, TagNameCasing } from '../nameCasing';
import { loadModelModifiersData, loadTemplateData } from './data';

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

let builtInData: html.HTMLDataV1;
let modelData: html.HTMLDataV1;

export function create(
	mode: 'html' | 'pug',
	getTsPluginClient?: (
		context: LanguageServiceContext,
	) => import('@vue/typescript-plugin/lib/requests').Requests | undefined,
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
	const baseService = mode === 'pug'
		? createPugService({
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
			getCustomData() {
				return [
					...customData,
					...extraCustomData,
				];
			},
			onDidChangeCustomData,
		});

	return {
		name: `vue-template (${mode})`,
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
			const tsPluginClient = getTsPluginClient?.(context);
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
					.split('\n- ')[4]
					.split('\n').slice(2, -1);
				for (let text of modifiers) {
					text = text.slice('  - `.'.length);
					const [name, desc] = text.split('` - ');
					vOnModifiers[name] = desc;
				}
			}
			if (vBind) {
				const markdown = typeof vBind.description === 'object'
					? vBind.description.value
					: vBind.description ?? '';
				const modifiers = markdown
					.split('\n- ')[4]
					.split('\n').slice(2, -1);
				for (let text of modifiers) {
					text = text.slice('  - `.'.length);
					const [name, desc] = text.split('` - ');
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
					if (!isSupportedDocument(document)) {
						return;
					}

					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					if (!sourceScript?.generated) {
						return;
					}

					const root = sourceScript.generated.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const fn = () =>
						baseServiceInstance.provideCompletionItems!(
							document,
							position,
							completionContext,
							token,
						);

					// #4298: Precompute HTMLDocument before provideHtmlData to avoid parseHTMLDocument requesting component names from tsserver
					await fn();

					const { sync, postprocess } = await provideHtmlData(sourceScript.id, root);
					let lastVersion = await sync();
					let result = await fn();
					while (lastVersion !== (lastVersion = await sync())) {
						result = await fn();
					}
					if (result) {
						postprocess(result, document);
						return result;
					}
				},

				provideHover(document, position, token) {
					if (!isSupportedDocument(document)) {
						return;
					}

					if (context.decodeEmbeddedDocumentUri(URI.parse(document.uri))) {
						updateExtraCustomData([]);
					}

					return baseServiceInstance.provideHover?.(document, position, token);
				},
			};

			async function provideHtmlData(sourceDocumentUri: URI, vueCode: VueVirtualCode) {
				await (initializing ??= initialize());

				const casing = await checkCasing(context, sourceDocumentUri);

				for (const tag of builtInData.tags ?? []) {
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

				const tasks: Promise<void>[] = [];
				const tagMap = new Map<string, {
					attrs: string[];
					propInfos: ComponentPropInfo[];
					events: string[];
					directives: string[];
				}>();
				const propMap = new Map<string, {
					name: string;
					isProp?: boolean;
					isEvent?: boolean;
					isGlobal?: boolean;
					info?: ComponentPropInfo;
				}>();

				let version = 0;
				let components: string[] | undefined;

				updateExtraCustomData([
					html.newHTMLDataProvider('vue-template-built-in', builtInData),
					{
						getId: () => 'vue-template',
						isApplicable: () => true,
						provideTags: () => {
							if (!components) {
								components = [];
								tasks.push((async () => {
									components = (await tsPluginClient?.getComponentNames(vueCode.fileName) ?? [])
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
							const scriptSetupRanges = tsCodegen.get(vueCode.sfc)?.getScriptSetupRanges();
							const names = new Set<string>();
							const tags: html.ITagData[] = [];

							for (const tag of components) {
								if (casing.tag === TagNameCasing.Kebab) {
									names.add(hyphenateTag(tag));
								}
								else if (casing.tag === TagNameCasing.Pascal) {
									names.add(tag);
								}
							}

							for (const binding of scriptSetupRanges?.bindings ?? []) {
								const name = vueCode.sfc.scriptSetup!.content.slice(binding.range.start, binding.range.end);
								if (casing.tag === TagNameCasing.Kebab) {
									names.add(hyphenateTag(name));
								}
								else if (casing.tag === TagNameCasing.Pascal) {
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
									const attrs = await tsPluginClient?.getElementAttrs(vueCode.fileName, tag) ?? [];
									const propInfos = await tsPluginClient?.getComponentProps(vueCode.fileName, tag) ?? [];
									const events = await tsPluginClient?.getComponentEvents(vueCode.fileName, tag) ?? [];
									const directives = await tsPluginClient?.getComponentDirectives(vueCode.fileName) ?? [];
									tagMap.set(tag, {
										attrs,
										propInfos: propInfos.filter(prop => !prop.name.startsWith('ref_')),
										events,
										directives,
									});
									version++;
								})());
							}

							const { attrs, propInfos, events, directives } = tagInfo;

							for (const prop of propInfos) {
								if (hyphenateTag(prop.name).startsWith('on-vnode-')) {
									prop.name = 'onVue:' + prop.name.slice('onVnode'.length);
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
									const eventName = propName.startsWith('on-')
										? propName.slice('on-'.length)
										: (propName['on'.length].toLowerCase() + propName.slice('onX'.length));

									for (
										const name of [
											'v-on:' + eventName,
											'@' + eventName,
										]
									) {
										attributes.push({ name });
										propMap.set(name, {
											name: propName,
											isEvent: true,
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
											isProp: true,
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
										isEvent: true,
									});
								}
							}

							for (const directive of directives) {
								const name = hyphenateAttr(directive);
								attributes.push({
									name,
								});
							}

							const models: [boolean, string][] = [];

							for (
								const prop of [
									...propInfos,
									...attrs.map(attr => ({ name: attr })),
								]
							) {
								if (prop.name.startsWith('onUpdate:')) {
									const isGlobal = !propNameSet.has(prop.name);
									models.push([isGlobal, prop.name.slice('onUpdate:'.length)]);
								}
							}
							for (const event of events) {
								if (event.startsWith('update:')) {
									models.push([false, event.slice('update:'.length)]);
								}
							}

							for (const [isGlobal, model] of models) {
								const name = casing.attr === AttrNameCasing.Camel ? model : hyphenateAttr(model);

								attributes.push({ name: 'v-model:' + name });
								propMap.set('v-model:' + name, {
									name,
									isProp: true,
									isGlobal,
								});

								if (model === 'modelValue') {
									propMap.set('v-model', {
										name,
										isProp: true,
										isGlobal,
									});
								}
							}

							return attributes;
						},
						provideValues: () => [],
					},
				]);

				return {
					postprocess,
					async sync() {
						await Promise.all(tasks);
						return version;
					},
				};

				function postprocess(completionList: CompletionList, document: TextDocument) {
					addDirectiveModifiers(completionList, document);

					// const tagMap = new Map<string, html.CompletionItem>();

					// completionList.items = completionList.items.filter(item => {
					// 	const key = item.kind + '_' + item.label;
					// 	if (!tagMap.has(key)) {
					// 		tagMap.set(key, item);
					// 		return true;
					// 	}
					// 	tagMap.get(key)!.documentation = item.documentation;
					// 	return false;
					// });

					const htmlDocumentations = new Map<string, string>();

					for (const item of completionList.items) {
						const documentation = typeof item.documentation === 'string'
							? item.documentation
							: item.documentation?.value;
						if (documentation?.trim()) {
							htmlDocumentations.set(item.label, documentation);
						}
					}

					for (const item of completionList.items) {
						const prop = propMap.get(item.label);

						if (prop?.info?.documentation) {
							item.documentation = {
								kind: 'markdown',
								value: prop.info.documentation,
							};
						}

						if (prop?.info?.deprecated) {
							item.tags = [1 satisfies typeof CompletionItemTag.Deprecated];
						}

						const tokens: string[] = [];

						if (
							item.kind === 10 satisfies typeof CompletionItemKind.Property
							&& components?.includes(hyphenateTag(item.label))
						) {
							item.kind = 6 satisfies typeof CompletionItemKind.Variable;
							tokens.push('\u0000');
						}
						else if (prop) {
							const { isEvent, propName } = getPropName(prop.name, !!prop.isEvent);

							if (prop.isProp) {
								if (!prop.isGlobal || specialProps.has(propName)) {
									item.kind = 5 satisfies typeof CompletionItemKind.Field;
								}
							}
							else if (isEvent) {
								item.kind = 23 satisfies typeof CompletionItemKind.Event;
								if (propName.startsWith('vue:')) {
									tokens.push('\u0004');
								}
							}

							if (!prop.isGlobal || specialProps.has(propName)) {
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
					}

					updateExtraCustomData([]);
				}
			}

			function addDirectiveModifiers(completionList: CompletionList, document: TextDocument) {
				const replacement = getReplacement(completionList, document);
				if (!replacement?.text.includes('.')) {
					return;
				}

				const [text, ...modifiers] = replacement.text.split('.');
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

					const description = currentModifiers[modifier];
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
						const json = await context.env.fs?.readFile?.(uri);
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

	function isSupportedDocument(document: TextDocument) {
		if (mode === 'pug') {
			return document.languageId === 'jade';
		}
		else {
			return document.languageId === 'html';
		}
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
