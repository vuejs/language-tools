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
import { URI } from 'vscode-uri';
import type { ComponentMeta, PropertyMeta } from '../../../component-meta';
import { loadModelModifiersData, loadTemplateData } from '../data';
import { format } from '../htmlFormatter';
import { AttrNameCasing, getAttrNameCasing, getTagNameCasing, TagNameCasing } from '../nameCasing';
import { resolveEmbeddedCode } from '../utils';

const DEPRECATED_MARKER = '**deprecated**\n\n';
const EVENT_PROP_REGEX = /^on[A-Z]/;

// String constants
const AUTO_IMPORT_PLACEHOLDER = 'AutoImportsPlaceholder';
const UPDATE_EVENT_PREFIX = 'update:';
const UPDATE_PROP_PREFIX = 'onUpdate:';

// Directive prefixes
const DIRECTIVE_V_ON = 'v-on:';
const DIRECTIVE_V_BIND = 'v-bind:';
const DIRECTIVE_V_MODEL = 'v-model:';
const V_ON_SHORTHAND = '@';
const V_BIND_SHORTHAND = ':';
const DIRECTIVE_V_FOR_NAME = 'v-for';

// Templates
const V_FOR_SNIPPET = '="${1:value} in ${2:source}"';

interface TagInfo {
	attrs: string[];
	meta: ComponentMeta | undefined | null;
}

let builtInData: html.HTMLDataV1 | undefined;
let modelData: html.HTMLDataV1 | undefined;

export function create(
	ts: typeof import('typescript'),
	languageId: 'html' | 'jade',
	tsserver: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	let htmlData: html.IHTMLDataProvider[] = [];
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
					const promise = tsserver.resolveModuleName(fileName, ref);
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
				return htmlData;
			},
			onDidChangeCustomData,
		})
		: createHtmlService({
			documentSelector: ['html', 'markdown'],
			useDefaultDataProvider: false,
			getDocumentContext,
			getCustomData() {
				return htmlData;
			},
			onDidChangeCustomData,
		});

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
			const transformedItems = new WeakSet<html.CompletionItem>();

			let lastCompletionDocument: TextDocument | undefined;

			return {
				...baseServiceInstance,

				dispose() {
					baseServiceInstance.dispose?.();
				},

				async provideCompletionItems(document, position, completionContext, token) {
					if (document.languageId !== languageId) {
						return;
					}
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}

					const prevText = document.getText({ start: { line: 0, character: 0 }, end: position });
					const hint: 'v' | ':' | '@' | undefined = prevText.match(/\bv[\S]*$/)
						? 'v'
						: prevText.match(/[:][\S]*$/)
						? ':'
						: prevText.match(/[@][\S]*$/)
						? '@'
						: undefined;

					const {
						result: htmlCompletion,
						info: {
							tagNameCasing,
							components,
						},
					} = await runWithVueDataProvider(
						info.script.id,
						info.root,
						hint,
						() =>
							baseServiceInstance.provideCompletionItems!(
								document,
								position,
								completionContext,
								token,
							),
					);
					const componentSet = new Set(components);

					if (!htmlCompletion) {
						return;
					}
					if (!hint) {
						htmlCompletion.isIncomplete = true;
					}

					await resolveAutoImportPlaceholder(htmlCompletion, info);
					resolveComponentItemKinds(htmlCompletion);

					return htmlCompletion;

					async function resolveAutoImportPlaceholder(
						htmlCompletion: CompletionList,
						info: NonNullable<ReturnType<typeof resolveEmbeddedCode>>,
					) {
						const autoImportPlaceholderIndex = htmlCompletion.items.findIndex(item =>
							item.label === AUTO_IMPORT_PLACEHOLDER
						);
						if (autoImportPlaceholderIndex === -1) {
							return;
						}
						const offset = document.offsetAt(position);
						const map = context.language.maps.get(info.code, info.script);
						let spliced = false;
						for (const [sourceOffset] of map.toSourceLocation(offset)) {
							const autoImport = await tsserver.getAutoImportSuggestions(
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

					function resolveComponentItemKinds(htmlCompletion: CompletionList) {
						for (const item of htmlCompletion.items) {
							switch (item.kind) {
								case 10 satisfies typeof CompletionItemKind.Property:
									if (
										componentSet.has(item.label)
										|| componentSet.has(capitalize(camelize(item.label)))
									) {
										item.kind = 6 satisfies typeof CompletionItemKind.Variable;
									}
									break;
								case 12 satisfies typeof CompletionItemKind.Value:
									addDirectiveModifiers(htmlCompletion, item, document);

									if (
										typeof item.documentation === 'object' && item.documentation.value.startsWith(DEPRECATED_MARKER)
									) {
										item.documentation.value = item.documentation.value.replace(DEPRECATED_MARKER, '');
										item.tags = [1 satisfies typeof CompletionItemTag.Deprecated];
									}

									if (item.label.startsWith(DIRECTIVE_V_ON) || item.label.startsWith(V_ON_SHORTHAND)) {
										item.kind = 23 satisfies typeof CompletionItemKind.Event;
									}
									else if (
										item.label.startsWith(DIRECTIVE_V_BIND)
										|| item.label.startsWith(V_BIND_SHORTHAND)
										|| item.label.startsWith(DIRECTIVE_V_MODEL)
									) {
										item.kind = 5 satisfies typeof CompletionItemKind.Field;
									}
									else if (item.label.startsWith('v-')) {
										item.kind = 14 satisfies typeof CompletionItemKind.Keyword;
									}

									if (item.label === DIRECTIVE_V_FOR_NAME) {
										item.textEdit!.newText = item.label + V_FOR_SNIPPET;
									}
									break;
							}
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
						const details = await tsserver.resolveAutoImportCompletionEntry(data);
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
					} = await runWithVueDataProvider(
						info.script.id,
						info.root,
						undefined,
						() => baseServiceInstance.provideHover!(document, position, token),
					);
					const templateAst = info.root.sfc.template?.ast;

					if (!templateAst || (htmlHover && hasContents(htmlHover.contents))) {
						return htmlHover;
					}

					for (const element of forEachElementNode(templateAst)) {
						const tagStart = element.loc.start.offset + element.loc.source.indexOf(element.tag);
						const tagEnd = tagStart + element.tag.length;
						const offset = document.offsetAt(position);

						if (offset >= tagStart && offset <= tagEnd) {
							const meta = await tsserver.getComponentMeta(info.root.fileName, element.tag);
							const props = meta?.props.filter(p => !p.global);
							let tableContents = '';

							if (props?.length) {
								tableContents += `<tr><th>Prop</th><th>Description</th><th>Default</th></tr>\n`;
								for (const p of props) {
									tableContents += `<tr>
											<td>${printName(p)}</td>
											<td>${printDescription(p)}</td>
											<td>${p.default ? `<code>${p.default}</code>` : ''}</td>
										</tr>\n`;
								}
							}

							if (meta?.events?.length) {
								tableContents += `<tr><th>Event</th><th>Description</th><th></th></tr>\n`;
								for (const e of meta.events) {
									tableContents += `<tr>
											<td>${printName(e)}</td>
											<td colspan="2">${printDescription(e)}</td>
										</tr>\n`;
								}
							}

							if (meta?.slots?.length) {
								tableContents += `<tr><th>Slot</th><th>Description</th><th></th></tr>\n`;
								for (const s of meta.slots) {
									tableContents += `<tr>
											<td>${printName(s)}</td>
											<td colspan="2">${printDescription(s)}</td>
										</tr>\n`;
								}
							}

							if (meta?.exposed.length) {
								tableContents += `<tr><th>Exposed</th><th>Description</th><th></th></tr>\n`;
								for (const e of meta.exposed) {
									tableContents += `<tr>
											<td>${printName(e)}</td>
											<td colspan="2">${printDescription(e)}</td>
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

					return htmlHover;

					function printName(meta: { name: string; tags: { name: string }[]; required?: boolean }) {
						let name = meta.name;
						if (meta.tags.some(tag => tag.name === 'deprecated')) {
							name = `<del>${name}</del>`;
						}
						if (meta.required) {
							name += ' <sup><em>required</em></sup>';
						}
						return name;
					}

					function printDescription(meta: { description?: string; type: string }) {
						let desc = `<code>${meta.type}</code>`;
						if (meta.description) {
							desc = `${meta.description}<br>${desc}`;
							desc = `<p>${desc}</p>`;
						}
						return desc;
					}

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

			async function runWithVueDataProvider<T>(
				sourceDocumentUri: URI,
				root: VueVirtualCode,
				hint: 'v' | ':' | '@' | undefined,
				fn: () => T,
			) {
				// #4298: Precompute HTMLDocument before provideHtmlData to avoid parseHTMLDocument requesting component names from tsserver
				await fn();

				const { sync } = await provideHtmlData(sourceDocumentUri, root, hint);
				let lastSync = await sync();
				let result = await fn();
				while (lastSync.version !== (lastSync = await sync()).version) {
					result = await fn();
				}
				return { result, ...lastSync };
			}

			async function provideHtmlData(
				sourceDocumentUri: URI,
				root: VueVirtualCode,
				hint: 'v' | ':' | '@' | undefined,
			) {
				const [tagNameCasing, attrNameCasing] = await Promise.all([
					getTagNameCasing(context, sourceDocumentUri),
					getAttrNameCasing(context, sourceDocumentUri),
				]);

				let version = 0;
				let components: string[] | undefined;
				let elements: string[] | undefined;
				let directives: string[] | undefined;
				let values: string[] | undefined;

				const tasks: Promise<void>[] = [];
				const tagDataMap = new Map<string, TagInfo>();

				updateExtraCustomData([
					{
						getId: () => 'vue-template',
						isApplicable: () => true,
						provideTags: () => {
							const { components, elements } = getComponentsAndElements();
							const codegen = tsCodegen.get(root.sfc);
							const names = new Set<string>();
							const tags: html.ITagData[] = [];
							const builtInTagMap = new Map<string, html.ITagData>();

							for (const tag of builtInData?.tags ?? []) {
								builtInTagMap.set(tag.name, tag);
								tags.push({
									...tag,
									name: tagNameCasing === TagNameCasing.Kebab ? hyphenateTag(tag.name) : tag.name,
								});
							}
							for (const tag of components) {
								names.add(tagNameCasing === TagNameCasing.Kebab ? hyphenateTag(tag) : tag);
							}
							for (const tag of elements) {
								names.add(tag);
							}
							if (codegen) {
								for (
									const name of [
										...codegen.getImportedComponents(),
										...codegen.getSetupExposed(),
									]
								) {
									names.add(tagNameCasing === TagNameCasing.Kebab ? hyphenateTag(name) : name);
								}
							}
							for (const name of names) {
								if (!builtInTagMap.has(name)) {
									tags.push({ name, attributes: [] });
								}
							}

							return tags;
						},
						provideAttributes: tag => {
							const directives = getDirectives();
							const { attrs, meta } = getTagData(tag);
							const attributes: html.IAttributeData[] = [];

							for (
								const [propName, propMeta] of [
									...meta?.props.map(prop => [prop.name, prop] as const) ?? [],
									...attrs.map(attr => [attr, undefined]),
								] as [string, PropertyMeta | undefined][]
							) {
								if (propName.match(EVENT_PROP_REGEX)) {
									let labelName = propName.slice(2);
									labelName = labelName.charAt(0).toLowerCase() + labelName.slice(1);
									if (attrNameCasing === AttrNameCasing.Kebab) {
										labelName = hyphenateAttr(labelName);
									}

									const label = !hint || hint === '@'
										? V_ON_SHORTHAND + labelName
										: hint === 'v'
										? DIRECTIVE_V_ON + labelName
										: undefined;

									if (label) {
										attributes.push({
											name: label,
											description: propMeta && createDescription(propMeta),
										});
									}
								}
								else {
									const labelName = attrNameCasing === AttrNameCasing.Camel ? propName : hyphenateAttr(propName);
									const propMeta2 = meta?.props.find(prop => {
										const name = attrNameCasing === AttrNameCasing.Camel ? prop.name : hyphenateAttr(prop.name);
										return name === labelName;
									});
									const label = !hint || hint === ':'
										? V_BIND_SHORTHAND + labelName
										: hint === 'v'
										? DIRECTIVE_V_BIND + labelName
										: undefined;

									if (label) {
										attributes.push({
											name: label,
											description: propMeta2 && createDescription(propMeta2),
										});
									}
								}
							}
							for (const event of meta?.events ?? []) {
								const eventName = attrNameCasing === AttrNameCasing.Camel ? event.name : hyphenateAttr(event.name);
								const label = !hint || hint === '@'
									? V_ON_SHORTHAND + eventName
									: hint === 'v'
									? DIRECTIVE_V_ON + eventName
									: undefined;

								if (label) {
									attributes.push({
										name: label,
										description: event && createDescription(event),
									});
								}
							}

							for (const globalAttr of builtInData?.globalAttributes ?? []) {
								attributes.push(globalAttr);
							}

							for (const directive of directives) {
								attributes.push({
									name: hyphenateAttr(directive),
								});
							}

							for (
								const [propName, propMeta] of [
									...meta?.props.map(prop => [prop.name, prop] as const) ?? [],
									...attrs.map(attr => [attr, undefined]),
								] as [string, PropertyMeta | undefined][]
							) {
								if (propName.startsWith(UPDATE_PROP_PREFIX)) {
									const model = propName.slice(UPDATE_PROP_PREFIX.length);
									const label = DIRECTIVE_V_MODEL
										+ (attrNameCasing === AttrNameCasing.Camel ? model : hyphenateAttr(model));
									attributes.push({
										name: label,
										description: propMeta && createDescription(propMeta),
									});
								}
							}
							if (!hint || hint === 'v') {
								for (const event of meta?.events ?? []) {
									if (event.name.startsWith(UPDATE_EVENT_PREFIX)) {
										const model = event.name.slice(UPDATE_EVENT_PREFIX.length);
										const label = DIRECTIVE_V_MODEL
											+ (attrNameCasing === AttrNameCasing.Camel ? model : hyphenateAttr(model));
										attributes.push({
											name: label,
											description: createDescription(event),
										});
									}
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
						provideTags: () => [{ name: AUTO_IMPORT_PLACEHOLDER, attributes: [] }],
						provideAttributes: () => [],
						provideValues: () => [],
					},
				]);

				return {
					async sync() {
						await Promise.all(tasks);
						return {
							version,
							info: {
								tagNameCasing,
								components,
							},
						};
					},
				};

				function createDescription(meta: Pick<PropertyMeta, 'description' | 'tags'>) {
					let description = meta?.description ?? '';
					if (meta?.tags.some(tag => tag.name === 'deprecated')) {
						description = DEPRECATED_MARKER + description;
					}
					if (!description) {
						return;
					}
					return {
						kind: 'markdown' as const,
						value: description,
					};
				}

				function getAttrValues(tag: string, attr: string) {
					if (!values) {
						values = [];
						tasks.push((async () => {
							if (tag === 'slot' && attr === 'name') {
								values = await tsserver.getComponentSlots(root.fileName) ?? [];
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
								attrs: await tsserver.getElementAttrs(root.fileName, tag) ?? [],
								meta: await tsserver.getComponentMeta(root.fileName, tag),
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
							directives = await tsserver.getComponentDirectives(root.fileName) ?? [];
							version++;
						})());
					}
					return directives;
				}

				function getComponentsAndElements() {
					if (!components || !elements) {
						components = [];
						elements = [];
						tasks.push((async () => {
							const res = await Promise.all([
								tsserver.getComponentNames(root.fileName),
								tsserver.getElementNames(root.fileName),
							]);
							components = res[0] ?? [];
							elements = res[1] ?? [];
							version++;
						})());
					}
					return {
						components,
						elements,
					};
				}
			}

			function addDirectiveModifiers(
				list: CompletionList,
				item: html.CompletionItem,
				document: TextDocument,
			) {
				const replacement = getReplacement(item, document);
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

					list.items.push(newItem);
				}
			}
		},
	};

	function updateExtraCustomData(newData: html.IHTMLDataProvider[]) {
		htmlData = newData;
		onDidChangeCustomDataListeners.forEach(l => l());
	}
}

function getReplacement(item: html.CompletionItem, doc: TextDocument) {
	if (item.textEdit && 'range' in item.textEdit) {
		return {
			item: item,
			textEdit: item.textEdit,
			text: doc.getText(item.textEdit.range),
		};
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
