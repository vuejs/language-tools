import {
	type CompletionItemKind,
	type CompletionItemTag,
	type CompletionList,
	type Disposable,
	type LanguageServiceContext,
	type LanguageServicePlugin,
	type TextDocument,
	transformCompletionItem,
} from '@volar/language-service';
import { getSourceRange } from '@volar/language-service/lib/utils/featureWorkers';
import {
	forEachElementNode,
	forEachInterpolationNode,
	hyphenateAttr,
	hyphenateTag,
	tsCodegen,
	type VueVirtualCode,
} from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import { create as createHtmlService, resolveReference } from 'volar-service-html';
import { create as createPugService } from 'volar-service-pug';
import {
	applyCompletionEntryDetails,
	convertCompletionInfo,
} from 'volar-service-typescript/lib/utils/lspConverters.js';
import * as html from 'vscode-html-languageservice';
import { URI, Utils } from 'vscode-uri';
import type { ComponentMeta, PropertyMeta } from '../../../component-meta';
import { loadModelModifiersData, loadTemplateData } from '../data';
import { format } from '../htmlFormatter';
import { AttrNameCasing, getAttrNameCasing, getTagNameCasing, TagNameCasing } from '../nameCasing';
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

const builtInComponents = new Set([
	'Transition',
	'TransitionGroup',
	'KeepAlive',
	'Suspense',
	'Teleport',
]);

// Sort text priority tokens
const SORT_TOKEN = {
	COMPONENT_PROP: '\u0000',
	COLON_PREFIX: '\u0001',
	AT_PREFIX: '\u0002',
	V_BIND_PREFIX: '\u0003',
	V_MODEL_PREFIX: '\u0004',
	V_ON_PREFIX: '\u0005',
	VUE_EVENT: '\u0004',
	SPECIAL_PROP: '\u0001',
	CONTROL_FLOW: '\u0003',
	DIRECTIVE: '\u0002',
	HTML_ATTR: '\u0001',
} as const;

// String constants
const AUTO_IMPORT_PLACEHOLDER = 'AutoImportsPlaceholder';
const EVENT_PROP_PREFIX = 'on-';
const UPDATE_EVENT_PREFIX = 'update:';
const UPDATE_PROP_PREFIX = 'onUpdate:';
const MODEL_VALUE_PROP = 'modelValue';

// Directive prefixes
const DIRECTIVE_V_ON = 'v-on:';
const DIRECTIVE_V_BIND = 'v-bind:';
const DIRECTIVE_V_MODEL = 'v-model:';
const V_ON_SHORTHAND = '@';
const V_BIND_SHORTHAND = ':';
const DIRECTIVE_V_FOR_NAME = 'v-for';

// Control flow directives
const CONTROL_FLOW_DIRECTIVES = ['v-if', 'v-else-if', 'v-else', 'v-for'] as const;

// Templates
const V_FOR_SNIPPET = '="${1:value} in ${2:source}"';

type CompletionTarget = 'tag' | 'attribute' | 'value';

interface TagInfo {
	attrs: string[];
	meta: ComponentMeta | undefined | null;
}

interface AttributeMetadata {
	name: string;
	kind: 'prop' | 'event';
	meta?: PropertyMeta;
}

let builtInData: html.HTMLDataV1 | undefined;
let modelData: html.HTMLDataV1 | undefined;

export function create(
	ts: typeof import('typescript'),
	languageId: 'html' | 'jade',
	{
		getComponentNames,
		getComponentMeta,
		getComponentDirectives,
		getComponentSlots,
		getElementAttrs,
		resolveModuleName,
		getAutoImportSuggestions,
		resolveAutoImportCompletionEntry,
	}: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	let customData: html.IHTMLDataProvider[] = [];
	let extraCustomData: html.IHTMLDataProvider[] = [];
	let modulePathCache:
		| Map<string, Promise<string | null | undefined> | string | null | undefined>
		| undefined;

	const onDidChangeCustomDataListeners = new Set<() => void>();
	const onDidChangeCustomData = (listener: () => void): Disposable => {
		onDidChangeCustomDataListeners.add(listener);
		return {
			dispose() {
				onDidChangeCustomDataListeners.delete(listener);
			},
		};
	};
	const getDocumentContext: (context: LanguageServiceContext) => html.DocumentContext = context => ({
		resolveReference(ref, base) {
			let baseUri = URI.parse(base);
			const decoded = context.decodeEmbeddedDocumentUri(baseUri);
			if (decoded) {
				baseUri = decoded[0];
			}
			if (
				modulePathCache
				&& baseUri.scheme === 'file'
				&& !ref.startsWith('./')
				&& !ref.startsWith('../')
			) {
				const map = modulePathCache;
				if (!map.has(ref)) {
					const fileName = baseUri.fsPath.replace(/\\/g, '/');
					const promise = resolveModuleName(fileName, ref);
					map.set(ref, promise);
					if (promise instanceof Promise) {
						promise.then(res => map.set(ref, res));
					}
				}
				const cached = modulePathCache.get(ref);
				if (cached instanceof Promise) {
					throw cached;
				}
				if (cached) {
					return cached;
				}
			}
			return resolveReference(ref, baseUri, context.env.workspaceFolders);
		},
	});
	const baseService = languageId === 'jade'
		? createPugService({
			useDefaultDataProvider: false,
			getDocumentContext,
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
			getDocumentContext,
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

			if (baseServiceInstance.provide['html/languageService']) {
				const htmlService: html.LanguageService = baseServiceInstance.provide['html/languageService']();
				const parseHTMLDocument = htmlService.parseHTMLDocument.bind(htmlService);

				htmlService.parseHTMLDocument = document => {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id === 'template') {
						const templateAst = info.root.sfc.template?.ast;
						if (templateAst) {
							let text = document.getText();
							for (const node of forEachInterpolationNode(templateAst)) {
								text = text.substring(0, node.loc.start.offset)
									+ ' '.repeat(node.loc.end.offset - node.loc.start.offset)
									+ text.substring(node.loc.end.offset);
							}
							return parseHTMLDocument({
								...document,
								getText: () => text,
							});
						}
					}
					return parseHTMLDocument(document);
				};
				htmlService.format = (document, range, options) => {
					let voidElements: string[] | undefined;
					const info = resolveEmbeddedCode(context, document.uri);
					const codegen = info && tsCodegen.get(info.root.sfc);
					if (codegen) {
						const componentNames = new Set([
							...codegen.getImportedComponents(),
							...codegen.getSetupExposed(),
						]);
						// copied from https://github.com/microsoft/vscode-html-languageservice/blob/10daf45dc16b4f4228987cf7cddf3a7dbbdc7570/src/beautify/beautify-html.js#L2746-L2761
						voidElements = [
							'area',
							'base',
							'br',
							'col',
							'embed',
							'hr',
							'img',
							'input',
							'keygen',
							'link',
							'menuitem',
							'meta',
							'param',
							'source',
							'track',
							'wbr',
							'!doctype',
							'?xml',
							'basefont',
							'isindex',
						].filter(tag =>
							tag
							&& !componentNames.has(tag)
							&& !componentNames.has(capitalize(camelize(tag)))
						);
					}
					return format(document, range, options, voidElements);
				};
			}

			builtInData ??= loadTemplateData(context.env.locale ?? 'en');
			modelData ??= loadModelModifiersData(context.env.locale ?? 'en');

			// https://vuejs.org/api/built-in-directives.html#v-on
			const vOnModifiers = extractDirectiveModifiers(builtInData.globalAttributes?.find(x => x.name === 'v-on'));
			// https://vuejs.org/api/built-in-directives.html#v-bind
			const vBindModifiers = extractDirectiveModifiers(builtInData.globalAttributes?.find(x => x.name === 'v-bind'));
			const vModelModifiers = extractModelModifiers(modelData.globalAttributes);

			const disposable = context.env.onDidChangeConfiguration?.(() => initializing = undefined);
			const transformedItems = new WeakSet<html.CompletionItem>();

			let initializing: Promise<void> | undefined;
			let lastCompletionDocument: TextDocument | undefined;

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
						result: htmlCompletion,
						target,
						info: {
							tagNameCasing,
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

					if (!htmlCompletion) {
						return;
					}

					await replaceAutoImportPlaceholder(htmlCompletion, info);

					switch (target) {
						case 'tag': {
							htmlCompletion.items.forEach(transformTag);
							break;
						}
						case 'attribute': {
							addDirectiveModifiers(htmlCompletion, document);
							htmlCompletion.items.forEach(transformAttribute);
							break;
						}
					}

					return htmlCompletion;

					async function replaceAutoImportPlaceholder(
						htmlCompletion: CompletionList,
						info: NonNullable<ReturnType<typeof resolveEmbeddedCode>>,
					) {
						const autoImportPlaceholderIndex = htmlCompletion.items.findIndex(item =>
							item.label === AUTO_IMPORT_PLACEHOLDER
						);
						if (autoImportPlaceholderIndex !== -1) {
							const offset = document.offsetAt(position);
							const map = context.language.maps.get(info.code, info.script);
							let spliced = false;
							for (const [sourceOffset] of map.toSourceLocation(offset)) {
								const autoImport = await getAutoImportSuggestions(
									info.root.fileName,
									sourceOffset,
								);
								if (!autoImport) {
									continue;
								}
								const tsCompletion = convertCompletionInfo(ts, autoImport, document, position, entry => entry.data);
								const placeholder = htmlCompletion.items[autoImportPlaceholderIndex]!;
								for (const tsItem of tsCompletion.items) {
									if (placeholder.textEdit) {
										const newText = tsItem.textEdit?.newText ?? tsItem.label;
										tsItem.textEdit = {
											...placeholder.textEdit,
											newText: tagNameCasing === TagNameCasing.Kebab
												? hyphenateTag(newText)
												: newText,
										};
									}
									else {
										tsItem.textEdit = undefined;
									}
								}
								htmlCompletion.items.splice(autoImportPlaceholderIndex, 1, ...tsCompletion.items);
								spliced = true;
								lastCompletionDocument = document;
								break;
							}
							if (!spliced) {
								htmlCompletion.items.splice(autoImportPlaceholderIndex, 1);
							}
						}
					}

					function transformTag(item: html.CompletionItem) {
						const tagName = capitalize(camelize(item.label));
						if (components?.includes(tagName)) {
							item.kind = 6 satisfies typeof CompletionItemKind.Variable;
							item.sortText = SORT_TOKEN.COMPONENT_PROP + (item.sortText ?? item.label);
						}
					}

					function transformAttribute(item: html.CompletionItem) {
						let prop = propMap.get(item.label);

						if (prop) {
							if (prop.meta?.description) {
								item.documentation = {
									kind: 'markdown',
									value: prop.meta.description,
								};
							}
							if (prop.meta?.tags.some(tag => tag.name === 'deprecated')) {
								item.tags = [1 satisfies typeof CompletionItemTag.Deprecated];
							}
						}
						else {
							const name = stripDirectivePrefix(item.label);
							if (specialProps.has(name)) {
								prop = {
									name,
									kind: 'prop',
								};
							}
						}

						// Set item kind
						if (prop) {
							// @ts-ignore
							if (prop.kind === 'prop' && !prop.meta?.isAttribute) {
								item.kind = 5 satisfies typeof CompletionItemKind.Field;
							}
							else if (prop.kind === 'event' || hyphenateAttr(prop.name).startsWith(EVENT_PROP_PREFIX)) {
								item.kind = 23 satisfies typeof CompletionItemKind.Event;
							}
						}
						else if (CONTROL_FLOW_DIRECTIVES.includes(item.label as any)) {
							item.kind = 14 satisfies typeof CompletionItemKind.Keyword;
						}
						else if (item.label.startsWith('v-')) {
							item.kind = 3 satisfies typeof CompletionItemKind.Function;
						}

						item.sortText = buildAttributeSortText(item.label, prop);

						if (item.label === DIRECTIVE_V_FOR_NAME) {
							item.textEdit!.newText = item.label + V_FOR_SNIPPET;
						}
					}
				},

				async resolveCompletionItem(item) {
					const data = item.data as import('@vue/typescript-plugin/lib/common').VueCompletionData;

					if (data?.__vue__autoImport || data?.__vue__componentAutoImport) {
						const embeddedUri = URI.parse(lastCompletionDocument!.uri);
						const decoded = context.decodeEmbeddedDocumentUri(embeddedUri);
						if (!decoded) {
							return item;
						}
						const sourceScript = context.language.scripts.get(decoded[0]);
						if (!sourceScript) {
							return item;
						}
						const details = await resolveAutoImportCompletionEntry(data);
						if (details) {
							const virtualCode = sourceScript.generated!.embeddedCodes.get(decoded[1])!;
							const sourceDocument = context.documents.get(
								sourceScript.id,
								sourceScript.languageId,
								sourceScript.snapshot,
							);
							const embeddedDocument = context.documents.get(embeddedUri, virtualCode.languageId, virtualCode.snapshot);
							const map = context.language.maps.get(virtualCode, sourceScript);
							item = transformCompletionItem(
								item,
								embeddedRange =>
									getSourceRange(
										[sourceDocument, embeddedDocument, map],
										embeddedRange,
									),
								embeddedDocument,
								context,
							);
							applyCompletionEntryDetails(
								ts,
								item,
								details,
								sourceDocument,
								fileName => URI.file(fileName),
								() => undefined,
							);
							transformedItems.add(item);
						}
					}
					return item;
				},

				transformCompletionItem(item) {
					if (transformedItems.has(item)) {
						return item;
					}
				},

				async provideHover(document, position, token) {
					if (document.languageId !== languageId) {
						return;
					}
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}
					let {
						result: htmlHover,
						target,
					} = await runWithVueData(
						info.script.id,
						info.root,
						() => baseServiceInstance.provideHover!(document, position, token),
					);
					const templateAst = info.root.sfc.template?.ast;

					if (target === 'tag' && templateAst && (!htmlHover || !hasContents(htmlHover.contents))) {
						for (const element of forEachElementNode(templateAst)) {
							const tagStart = element.loc.start.offset + element.loc.source.indexOf(element.tag);
							const tagEnd = tagStart + element.tag.length;
							const offset = document.offsetAt(position);

							if (offset >= tagStart && offset <= tagEnd) {
								const meta = await getComponentMeta(info.root.fileName, element.tag);
								const props = meta?.props.filter(p => !p.global);
								let tableContents = '';

								if (props?.length) {
									tableContents += `<tr>
										<th>Prop</th>
										<th>Description</th>
										<th>Default</th>
									</tr>\n`;
									for (const p of props) {
										let name = `<b>${p.name}</b>`;
										if (p.tags.some(tag => tag.name === 'deprecated')) {
											name = `<del>${name}</del>`;
										}
										tableContents += `<tr>
											<td>${name}${p.required ? ' <sup><em>required</em></sup>' : ''}</td>
											<td>${p.description ? `<p>${p.description}</p>` : ''}<code>${p.type}</code></td>
											<td>${p.default ? `<code>${p.default}</code>` : ''}</td>
										</tr>\n`;
									}
								}

								if (meta?.events?.length) {
									tableContents += `<tr>
										<th>Event</th>
										<th colspan="2">Description</th>
									</tr>\n`;
									for (const e of meta.events) {
										let name = `<b>${e.name}</b>`;
										if (e.tags.some(tag => tag.name === 'deprecated')) {
											name = `<del>${name}</del>`;
										}
										tableContents += `<tr>
											<td>${name}</td>
											<td>${e.description ? `<p>${e.description}</p>` : ''}<code>${e.type}</code></td>
											<td></td>
										</tr>\n`;
									}
								}

								if (meta?.slots?.length) {
									tableContents += `<tr>
										<th>Slot</th>
										<th colspan="2">Description</th>
									</tr>\n`;
									for (const s of meta.slots) {
										let name = `<b>${s.name}</b>`;
										if (s.tags.some(tag => tag.name === 'deprecated')) {
											name = `<del>${name}</del>`;
										}
										tableContents += `<tr>
											<td>${name}</td>
											<td>${s.description ? `<p>${s.description}</p>` : ''}<code>${s.type}</code></td>
											<td></td>
										</tr>\n`;
									}
								}

								if (meta?.exposed.length) {
									tableContents += `<tr>
										<th>Exposed</th>
										<th colspan="2">Description</th>
									</tr>\n`;
									for (const e of meta.exposed) {
										let name = `<b>${e.name}</b>`;
										if (e.tags.some(tag => tag.name === 'deprecated')) {
											name = `<del>${name}</del>`;
										}
										tableContents += `<tr>
											<td>${name}</td>
											<td>${e.description ? `<p>${e.description}</p>` : ''}<code>${e.type}</code></td>
											<td></td>
										</tr>\n`;
									}
								}

								htmlHover ??= {
									range: {
										start: document.positionAt(tagStart),
										end: document.positionAt(tagEnd),
									},
									contents: '',
								};
								htmlHover.contents = {
									kind: 'markdown',
									value: tableContents
										? `<table>\n${tableContents}\n</table>`
										: `No info available.`,
								};
							}
						}
					}

					return htmlHover;

					function hasContents(contents: html.MarkupContent | html.MarkedString | html.MarkedString[]) {
						if (typeof contents === 'string') {
							return !!contents;
						}
						if (Array.isArray(contents)) {
							return contents.some(hasContents);
						}
						return !!contents.value;
					}
				},

				async provideDocumentLinks(document, token) {
					modulePathCache = new Map();
					while (true) {
						try {
							const result = await baseServiceInstance.provideDocumentLinks?.(document, token);
							modulePathCache = undefined;
							return result;
						}
						catch (e) {
							if (e instanceof Promise) {
								await e;
							}
							else {
								throw e;
							}
						}
					}
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

				const [tagNameCasing, attrNameCasing] = await Promise.all([
					getTagNameCasing(context, sourceDocumentUri),
					getAttrNameCasing(context, sourceDocumentUri),
				]);

				for (const tag of builtInData!.tags ?? []) {
					if (specialTags.has(tag.name)) {
						continue;
					}
					if (tagNameCasing === TagNameCasing.Kebab) {
						tag.name = hyphenateTag(tag.name);
					}
					else {
						tag.name = camelize(capitalize(tag.name));
					}
				}

				let version = 0;
				let target: CompletionTarget;
				let components: string[] | undefined;
				let directives: string[] | undefined;
				let values: string[] | undefined;

				const tasks: Promise<void>[] = [];
				const tagDataMap = new Map<string, TagInfo>();
				const propMap = new Map<string, AttributeMetadata>();

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
							const components = getComponents();
							const codegen = tsCodegen.get(root.sfc);
							const names = new Set<string>();
							const tags: html.ITagData[] = [];

							for (const tag of components) {
								if (tagNameCasing === TagNameCasing.Kebab) {
									names.add(hyphenateTag(tag));
								}
								else {
									names.add(tag);
								}
							}
							if (codegen) {
								for (
									const name of [
										...codegen.getImportedComponents(),
										...codegen.getSetupExposed(),
									]
								) {
									if (tagNameCasing === TagNameCasing.Kebab) {
										names.add(hyphenateTag(name));
									}
									else {
										names.add(name);
									}
								}
							}
							for (const name of names) {
								tags.push({ name, attributes: [] });
							}

							return tags;
						},
						provideAttributes: tag => {
							const directives = getDirectives();
							const { attrs, meta } = getTagData(tag);
							const attributes: html.IAttributeData[] = [];
							const models: string[] = [];

							for (
								const prop of [
									...meta?.props ?? [],
									// ...attrs.map<PropertyMeta>(attr => ({ name: attr, isAttribute: true })),
								]
							) {
								const propName = attrNameCasing === AttrNameCasing.Camel ? prop.name : hyphenateAttr(prop.name);
								const isEvent = hyphenateAttr(propName).startsWith(EVENT_PROP_PREFIX);
								if (isEvent) {
									const eventName = attrNameCasing === AttrNameCasing.Camel
										? propName['on'.length]!.toLowerCase() + propName.slice('onX'.length)
										: propName.slice(EVENT_PROP_PREFIX.length);

									for (const name of [DIRECTIVE_V_ON + eventName, V_ON_SHORTHAND + eventName]) {
										attributes.push({ name });
										propMap.set(name, {
											name: propName,
											kind: 'event',
											meta: prop,
										});
									}
								}
								else {
									const propInfo = meta?.props.find(prop => {
										const name = attrNameCasing === AttrNameCasing.Camel ? prop.name : hyphenateAttr(prop.name);
										return name === propName;
									});

									for (const name of [propName, V_BIND_SHORTHAND + propName, DIRECTIVE_V_BIND + propName]) {
										attributes.push({
											name,
											// valueSet: prop.values?.some(value => typeof value === 'string') ? '__deferred__' : undefined,
										});
										propMap.set(name, {
											name: propName,
											kind: 'prop',
											meta: propInfo,
										});
									}
								}
							}
							for (const event of meta?.events ?? []) {
								const eventName = attrNameCasing === AttrNameCasing.Camel ? event.name : hyphenateAttr(event.name);
								for (const name of [DIRECTIVE_V_ON + eventName, V_ON_SHORTHAND + eventName]) {
									attributes.push({ name });
									propMap.set(name, {
										name: eventName,
										kind: 'event',
									});
								}
							}
							for (const directive of directives) {
								attributes.push({
									name: hyphenateAttr(directive),
								});
							}
							for (
								const prop of [
									...meta?.props ?? [],
									...attrs.map(attr => ({ name: attr })),
								]
							) {
								if (prop.name.startsWith(UPDATE_PROP_PREFIX)) {
									models.push(prop.name.slice(UPDATE_PROP_PREFIX.length));
								}
							}
							for (const event of meta?.events ?? []) {
								if (event.name.startsWith(UPDATE_EVENT_PREFIX)) {
									models.push(event.name.slice(UPDATE_EVENT_PREFIX.length));
								}
							}
							for (const model of models) {
								const name = attrNameCasing === AttrNameCasing.Camel ? model : hyphenateAttr(model);
								attributes.push({ name: DIRECTIVE_V_MODEL + name });
								propMap.set(DIRECTIVE_V_MODEL + name, {
									name,
									kind: 'prop',
								});
								if (model === MODEL_VALUE_PROP) {
									propMap.set('v-model', {
										name,
										kind: 'prop',
									});
								}
							}

							return attributes;
						},
						provideValues: (tag, attr) => {
							return getAttrValues(tag, attr).map(value => ({ name: value }));
						},
					},
					{
						getId: () => 'vue-auto-imports',
						isApplicable: () => true,
						provideTags() {
							return [{ name: AUTO_IMPORT_PLACEHOLDER, attributes: [] }];
						},
						provideAttributes() {
							return [];
						},
						provideValues() {
							return [];
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
								tagNameCasing,
								components,
								propMap,
							},
						};
					},
				};

				function getAttrValues(tag: string, attr: string) {
					if (!values) {
						values = [];
						tasks.push((async () => {
							if (tag === 'slot' && attr === 'name') {
								values = await getComponentSlots(root.fileName) ?? [];
							}
							version++;
						})());
					}
					return values;
				}

				function getTagData(tag: string) {
					let data = tagDataMap.get(tag);
					if (!data) {
						data = { attrs: [], meta: undefined };
						tagDataMap.set(tag, data);
						tasks.push((async () => {
							tagDataMap.set(tag, {
								attrs: await getElementAttrs(root.fileName, tag) ?? [],
								meta: await getComponentMeta(root.fileName, tag),
							});
							version++;
						})());
					}
					return data;
				}

				function getDirectives() {
					if (!directives) {
						directives = [];
						tasks.push((async () => {
							directives = await getComponentDirectives(root.fileName) ?? [];
							version++;
						})());
					}
					return directives;
				}

				function getComponents() {
					if (!components) {
						components = [];
						tasks.push((async () => {
							components = await getComponentNames(root.fileName) ?? [];
							components = components.filter(name => !builtInComponents.has(name));
							version++;
						})());
					}
					return components;
				}
			}

			function addDirectiveModifiers(completionList: CompletionList, document: TextDocument) {
				const replacement = getReplacement(completionList, document);
				if (!replacement?.text.includes('.')) {
					return;
				}

				const [text, ...modifiers] = replacement.text.split('.') as [string, ...string[]];
				const isVOn = text.startsWith(DIRECTIVE_V_ON) || text.startsWith(V_ON_SHORTHAND) && text.length > 1;
				const isVBind = text.startsWith(DIRECTIVE_V_BIND) || text.startsWith(V_BIND_SHORTHAND) && text.length > 1;
				const isVModel = text.startsWith(DIRECTIVE_V_MODEL) || text === 'v-model';
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

function extractDirectiveModifiers(directive: html.IAttributeData | undefined): Record<string, string> {
	const modifiers: Record<string, string> = {};
	if (!directive) {
		return modifiers;
	}
	const markdown = typeof directive.description === 'object'
		? directive.description.value
		: directive.description ?? '';
	const modifierLines = markdown
		.split('\n- ')[4]
		?.split('\n').slice(2, -1) ?? [];
	for (let text of modifierLines) {
		text = text.slice('  - `.'.length);
		const [name, desc] = text.split('` - ') as [string, string];
		modifiers[name] = desc;
	}
	return modifiers;
}

function extractModelModifiers(attributes: html.IAttributeData[] | undefined): Record<string, string> {
	const modifiers: Record<string, string> = {};
	if (!attributes) {
		return modifiers;
	}
	for (const modifier of attributes) {
		const description = typeof modifier.description === 'object'
			? modifier.description.value
			: modifier.description ?? '';
		const references = modifier.references?.map(ref => `[${ref.name}](${ref.url})`).join(' | ');
		modifiers[modifier.name] = description + '\n\n' + references;
	}
	return modifiers;
}

function buildAttributeSortText(
	label: string,
	prop: AttributeMetadata | undefined,
): string {
	const tokens: string[] = [];

	if (prop) {
		// @ts-ignore
		if (!prop.meta?.isAttribute) {
			tokens.push(SORT_TOKEN.COMPONENT_PROP);

			if (label.startsWith(V_BIND_SHORTHAND)) {
				tokens.push(SORT_TOKEN.COLON_PREFIX);
			}
			else if (label.startsWith(V_ON_SHORTHAND)) {
				tokens.push(SORT_TOKEN.AT_PREFIX);
			}
			else if (label.startsWith(DIRECTIVE_V_BIND)) {
				tokens.push(SORT_TOKEN.V_BIND_PREFIX);
			}
			else if (label.startsWith(DIRECTIVE_V_MODEL)) {
				tokens.push(SORT_TOKEN.V_MODEL_PREFIX);
			}
			else if (label.startsWith(DIRECTIVE_V_ON)) {
				tokens.push(SORT_TOKEN.V_ON_PREFIX);
			}
			else {
				tokens.push(SORT_TOKEN.COMPONENT_PROP);
			}

			if (specialProps.has(prop.name)) {
				tokens.push(SORT_TOKEN.SPECIAL_PROP);
			}
			else {
				tokens.push(SORT_TOKEN.COMPONENT_PROP);
			}
		}

		if (prop.name.startsWith('onVue:')) {
			tokens.unshift(SORT_TOKEN.VUE_EVENT);
		}
	}
	else if (CONTROL_FLOW_DIRECTIVES.includes(label as any)) {
		tokens.push(SORT_TOKEN.CONTROL_FLOW);
	}
	else if (label.startsWith('v-')) {
		tokens.push(SORT_TOKEN.DIRECTIVE);
	}
	else {
		tokens.push(SORT_TOKEN.HTML_ATTR);
	}

	return tokens.join('') + label;
}

function stripDirectivePrefix(name: string): string {
	for (const prefix of [DIRECTIVE_V_BIND, V_BIND_SHORTHAND]) {
		if (name.startsWith(prefix) && name !== prefix) {
			return name.slice(prefix.length);
		}
	}
	return name;
}
