import type { Disposable, LanguageServiceContext, LanguageServiceEnvironment, LanguageServicePluginInstance } from '@volar/language-service';
import { VueVirtualCode, hyphenateAttr, hyphenateTag, parseScriptSetupRanges, tsCodegen } from '@vue/language-core';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import { create as createHtmlService } from 'volar-service-html';
import { create as createPugService } from 'volar-service-pug';
import * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { getNameCasing } from '../ideFeatures/nameCasing';
import { AttrNameCasing, LanguageServicePlugin, TagNameCasing, VueCompilerOptions } from '../types';
import { loadModelModifiersData, loadTemplateData } from './data';
import { URI, Utils } from 'vscode-uri';
import { getComponentSpans } from '@vue/typescript-plugin/lib/common';

let builtInData: html.HTMLDataV1;
let modelData: html.HTMLDataV1;

export function create(
	mode: 'html' | 'pug',
	ts: typeof import('typescript'),
	getVueOptions: (env: LanguageServiceEnvironment) => VueCompilerOptions,
	getTsPluginClient?: (context: LanguageServiceContext) => typeof import('@vue/typescript-plugin/lib/client') | undefined
): LanguageServicePlugin {

	let customData: html.IHTMLDataProvider[] = [];
	let extraCustomData: html.IHTMLDataProvider[] = [];
	let lastCompletionComponentNames = new Set<string>();

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
			inlayHintProvider: {},
			hoverProvider: true,
			diagnosticProvider: true,
			semanticTokensProvider: {
				legend: {
					tokenTypes: ['class'],
					tokenModifiers: [],
				},
			}
		},
		create(context, api): LanguageServicePluginInstance {
			const tsPluginClient = getTsPluginClient?.(context);
			const baseServiceInstance = baseService.create(context, api);
			const vueCompilerOptions = getVueOptions(context.env);

			builtInData ??= loadTemplateData(context.env.locale ?? 'en');
			modelData ??= loadModelModifiersData(context.env.locale ?? 'en');

			// https://vuejs.org/api/built-in-directives.html#v-on
			// https://vuejs.org/api/built-in-directives.html#v-bind
			const eventModifiers: Record<string, string> = {};
			const propModifiers: Record<string, string> = {};
			const vOn = builtInData.globalAttributes?.find(x => x.name === 'v-on');
			const vBind = builtInData.globalAttributes?.find(x => x.name === 'v-bind');

			if (vOn) {
				const markdown = (typeof vOn.description === 'string' ? vOn.description : vOn.description?.value) ?? '';
				const modifiers = markdown
					.split('\n- ')[4]
					.split('\n').slice(2, -1);
				for (let text of modifiers) {
					text = text.substring('  - `.'.length);
					const [name, disc] = text.split('` - ');
					eventModifiers[name] = disc;
				}
			}
			if (vBind) {
				const markdown = (typeof vBind.description === 'string' ? vBind.description : vBind.description?.value) ?? '';
				const modifiers = markdown
					.split('\n- ')[4]
					.split('\n').slice(2, -1);
				for (let text of modifiers) {
					text = text.substring('  - `.'.length);
					const [name, disc] = text.split('` - ');
					propModifiers[name] = disc;
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

					let sync: (() => Promise<number>) | undefined;
					let currentVersion: number | undefined;

					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					if (sourceScript?.generated?.root instanceof VueVirtualCode) {

						// #4298: Precompute HTMLDocument before provideHtmlData to avoid parseHTMLDocument requesting component names from tsserver
						baseServiceInstance.provideCompletionItems?.(document, position, completionContext, token);

						sync = (await provideHtmlData(sourceScript.id, sourceScript.generated.root)).sync;
						currentVersion = await sync();
					}

					let htmlComplete = await baseServiceInstance.provideCompletionItems?.(document, position, completionContext, token);
					while (currentVersion !== (currentVersion = await sync?.())) {
						htmlComplete = await baseServiceInstance.provideCompletionItems?.(document, position, completionContext, token);
					}
					if (!htmlComplete) {
						return;
					}

					if (sourceScript?.generated?.root instanceof VueVirtualCode) {
						await afterHtmlCompletion(
							htmlComplete,
							context.documents.get(sourceScript.id, sourceScript.languageId, sourceScript.snapshot)
						);
					}

					return htmlComplete;
				},

				async provideInlayHints(document) {

					if (!isSupportedDocument(document)) {
						return;
					}

					const enabled = await context.env.getConfiguration?.<boolean>('vue.inlayHints.missingProps') ?? false;
					if (!enabled) {
						return;
					}

					const result: vscode.InlayHint[] = [];
					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!virtualCode) {
						return;
					}

					const code = context.language.scripts.get(decoded[0])?.generated?.root;
					const scanner = getScanner(baseServiceInstance, document);

					if (code instanceof VueVirtualCode && scanner) {

						// visualize missing required props
						const casing = await getNameCasing(context, decoded[0]);
						const components = await tsPluginClient?.getComponentNames(code.fileName) ?? [];
						const componentProps: Record<string, string[]> = {};
						let token: html.TokenType;
						let current: {
							unburnedRequiredProps: string[];
							labelOffset: number;
							insertOffset: number;
						} | undefined;
						while ((token = scanner.scan()) !== html.TokenType.EOS) {
							if (token === html.TokenType.StartTag) {
								const tagName = scanner.getTokenText();
								const checkTag = tagName.indexOf('.') >= 0
									? tagName
									: components.find(component => component === tagName || hyphenateTag(component) === tagName);
								if (checkTag) {
									componentProps[checkTag] ??= await tsPluginClient?.getComponentProps(code.fileName, checkTag, true) ?? [];
									current = {
										unburnedRequiredProps: [...componentProps[checkTag]],
										labelOffset: scanner.getTokenOffset() + scanner.getTokenLength(),
										insertOffset: scanner.getTokenOffset() + scanner.getTokenLength(),
									};
								}
							}
							else if (token === html.TokenType.AttributeName) {
								if (current) {
									let attrText = scanner.getTokenText();

									if (attrText === 'v-bind') {
										current.unburnedRequiredProps = [];
									}
									else {
										// remove modifiers
										if (attrText.indexOf('.') >= 0) {
											attrText = attrText.split('.')[0];
										}
										// normalize
										if (attrText.startsWith('v-bind:')) {
											attrText = attrText.substring('v-bind:'.length);
										}
										else if (attrText.startsWith(':')) {
											attrText = attrText.substring(':'.length);
										}
										else if (attrText.startsWith('v-model:')) {
											attrText = attrText.substring('v-model:'.length);
										}
										else if (attrText === 'v-model') {
											attrText = vueCompilerOptions.target >= 3 ? 'modelValue' : 'value'; // TODO: support for experimentalModelPropName?
										}
										else if (attrText.startsWith('@')) {
											attrText = 'on-' + hyphenateAttr(attrText.substring('@'.length));
										}

										current.unburnedRequiredProps = current.unburnedRequiredProps.filter(propName => {
											return attrText !== propName
												&& attrText !== hyphenateAttr(propName);
										});
									}
								}
							}
							else if (token === html.TokenType.StartTagSelfClose || token === html.TokenType.StartTagClose) {
								if (current) {
									for (const requiredProp of current.unburnedRequiredProps) {
										result.push({
											label: `${requiredProp}!`,
											paddingLeft: true,
											position: document.positionAt(current.labelOffset),
											kind: 2 satisfies typeof vscode.InlayHintKind.Parameter,
											textEdits: [{
												range: {
													start: document.positionAt(current.insertOffset),
													end: document.positionAt(current.insertOffset),
												},
												newText: ` :${casing.attr === AttrNameCasing.Kebab ? hyphenateAttr(requiredProp) : requiredProp}=`,
											}],
										});
									}
									current = undefined;
								}
							}
							if (token === html.TokenType.AttributeName || token === html.TokenType.AttributeValue) {
								if (current) {
									current.insertOffset = scanner.getTokenOffset() + scanner.getTokenLength();
								}
							}
						}
					}

					return result;
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

				async provideDiagnostics(document, token) {

					if (!isSupportedDocument(document)) {
						return;
					}

					const originalResult = await baseServiceInstance.provideDiagnostics?.(document, token);
					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!virtualCode) {
						return;
					}

					const code = context.language.scripts.get(decoded[0])?.generated?.root;
					if (!(code instanceof VueVirtualCode)) {
						return;
					}

					const templateErrors: vscode.Diagnostic[] = [];
					const { template } = code.sfc;

					if (template) {

						for (const error of template.errors) {
							onCompilerError(error, 1 satisfies typeof vscode.DiagnosticSeverity.Error);
						}

						for (const warning of template.warnings) {
							onCompilerError(warning, 2 satisfies typeof vscode.DiagnosticSeverity.Warning);
						}

						function onCompilerError(error: NonNullable<typeof template>['errors'][number], severity: vscode.DiagnosticSeverity) {

							const templateHtmlRange = {
								start: error.loc?.start.offset ?? 0,
								end: error.loc?.end.offset ?? 0,
							};
							let errorMessage = error.message;

							templateErrors.push({
								range: {
									start: document.positionAt(templateHtmlRange.start),
									end: document.positionAt(templateHtmlRange.end),
								},
								severity,
								code: error.code,
								source: 'vue',
								message: errorMessage,
							});
						}
					}

					return [
						...originalResult ?? [],
						...templateErrors,
					];
				},

				provideDocumentSemanticTokens(document, range, legend) {
					if (!isSupportedDocument(document)) {
						return;
					}
					const languageService = context.inject<(import('volar-service-typescript').Provide), 'typescript/languageService'>('typescript/languageService');
					if (!languageService) {
						return;
					}
					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					if (
						!sourceScript
						|| !(sourceScript.generated?.root instanceof VueVirtualCode)
						|| !sourceScript.generated.root.sfc.template
					) {
						return [];
					}
					const { template } = sourceScript.generated.root.sfc;
					const spans = getComponentSpans.call(
						{
							files: context.language.scripts,
							languageService,
							typescript: ts,
							vueOptions: getVueOptions(context.env),
						},
						sourceScript.generated.root,
						template,
						{
							start: document.offsetAt(range.start),
							length: document.offsetAt(range.end) - document.offsetAt(range.start),
						});
					const classTokenIndex = legend.tokenTypes.indexOf('class');
					return spans.map(span => {
						const start = document.positionAt(span.start);
						return [
							start.line,
							start.character,
							span.length,
							classTokenIndex,
							0,
						];
					});
				},
			};

			async function provideHtmlData(sourceDocumentUri: URI, vueCode: VueVirtualCode) {

				await (initializing ??= initialize());

				const casing = await getNameCasing(context, sourceDocumentUri);

				if (builtInData.tags) {
					for (const tag of builtInData.tags) {
						if (tag.name === 'slot') {
							continue;
						}
						if (tag.name === 'component') {
							continue;
						}
						if (tag.name === 'template') {
							continue;
						}
						if (casing.tag === TagNameCasing.Kebab) {
							tag.name = hyphenateTag(tag.name);
						}
						else {
							tag.name = camelize(capitalize(tag.name));
						}
					}
				}

				const promises: Promise<void>[] = [];
				const tagInfos = new Map<string, {
					attrs: string[];
					props: string[];
					events: string[];
				}>();

				let version = 0;
				let components: string[] | undefined;
				let templateContextProps: string[] | undefined;

				updateExtraCustomData([
					html.newHTMLDataProvider('vue-template-built-in', builtInData),
					{
						getId: () => 'vue-template',
						isApplicable: () => true,
						provideTags: () => {
							if (!components) {
								promises.push((async () => {
									components = (await tsPluginClient?.getComponentNames(vueCode.fileName) ?? [])
										.filter(name =>
											name !== 'Transition'
											&& name !== 'TransitionGroup'
											&& name !== 'KeepAlive'
											&& name !== 'Suspense'
											&& name !== 'Teleport'
										);
									lastCompletionComponentNames = new Set(components);
									version++;
								})());
								return [];
							}
							const scriptSetupRanges = vueCode.sfc.scriptSetup ? parseScriptSetupRanges(ts, vueCode.sfc.scriptSetup.ast, vueCompilerOptions) : undefined;
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
								const name = vueCode.sfc.scriptSetup!.content.substring(binding.start, binding.end);
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
							const tagInfo = tagInfos.get(tag);

							if (!tagInfo) {
								promises.push((async () => {
									const attrs = await tsPluginClient?.getElementAttrs(vueCode.fileName, tag) ?? [];
									const props = await tsPluginClient?.getComponentProps(vueCode.fileName, tag) ?? [];
									const events = await tsPluginClient?.getComponentEvents(vueCode.fileName, tag) ?? [];
									tagInfos.set(tag, {
										attrs,
										props: props.filter(prop =>
											!prop.startsWith('ref_')
											&& !hyphenate(prop).startsWith('on-vnode-')
										),
										events,
									});
									version++;
								})());
								return [];
							}

							const { attrs, props, events } = tagInfo;
							const attributes: html.IAttributeData[] = [];
							const _tsCodegen = tsCodegen.get(vueCode.sfc);

							if (_tsCodegen) {
								if (!templateContextProps) {
									promises.push((async () => {
										templateContextProps = await tsPluginClient?.getTemplateContextProps(vueCode.fileName) ?? [];
										version++;
									})());
									return [];
								}
								let ctxVars = [
									..._tsCodegen.scriptRanges()?.bindings.map(binding => vueCode.sfc.script!.content.substring(binding.start, binding.end)) ?? [],
									..._tsCodegen.scriptSetupRanges()?.bindings.map(binding => vueCode.sfc.scriptSetup!.content.substring(binding.start, binding.end)) ?? [],
									...templateContextProps,
								];
								ctxVars = [...new Set(ctxVars)];
								const dirs = ctxVars.map(hyphenateAttr).filter(v => v.startsWith('v-'));
								for (const dir of dirs) {
									attributes.push(
										{
											name: dir,
										}
									);
								}
							}

							const propsSet = new Set(props);

							for (const prop of [...props, ...attrs]) {

								const isGlobal = !propsSet.has(prop);
								const name = casing.attr === AttrNameCasing.Camel ? prop : hyphenateAttr(prop);

								if (hyphenateAttr(name).startsWith('on-')) {

									const propNameBase = name.startsWith('on-')
										? name.slice('on-'.length)
										: (name['on'.length].toLowerCase() + name.slice('onX'.length));
									const propKey = createInternalItemId('componentEvent', [isGlobal ? '*' : tag, propNameBase]);

									attributes.push(
										{
											name: 'v-on:' + propNameBase,
											description: propKey,
										},
										{
											name: '@' + propNameBase,
											description: propKey,
										}
									);
								}
								{

									const propName = name;
									const propKey = createInternalItemId('componentProp', [isGlobal ? '*' : tag, propName]);

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
										}
									);
								}
							}

							for (const event of events) {

								const name = casing.attr === AttrNameCasing.Camel ? event : hyphenateAttr(event);
								const propKey = createInternalItemId('componentEvent', [tag, name]);

								attributes.push({
									name: 'v-on:' + name,
									description: propKey,
								});
								attributes.push({
									name: '@' + name,
									description: propKey,
								});
							}

							const models: [boolean, string][] = [];

							for (const prop of [...props, ...attrs]) {
								if (prop.startsWith('onUpdate:')) {
									const isGlobal = !propsSet.has(prop);
									models.push([isGlobal, prop.substring('onUpdate:'.length)]);
								}
							}
							for (const event of events) {
								if (event.startsWith('update:')) {
									models.push([false, event.substring('update:'.length)]);
								}
							}

							for (const [isGlobal, model] of models) {

								const name = casing.attr === AttrNameCasing.Camel ? model : hyphenateAttr(model);
								const propKey = createInternalItemId('componentProp', [isGlobal ? '*' : tag, name]);

								attributes.push({
									name: 'v-model:' + name,
									description: propKey,
								});

								if (model === 'modelValue') {
									attributes.push({
										name: 'v-model',
										description: propKey,
									});
								}
							}

							return attributes;
						},
						provideValues: () => [],
					},
				]);

				return {
					async sync() {
						await Promise.all(promises);
						return version;
					}
				};
			}

			function afterHtmlCompletion(completionList: vscode.CompletionList, sourceDocument: TextDocument) {

				const replacement = getReplacement(completionList, sourceDocument);

				if (replacement) {

					const isEvent = replacement.text.startsWith('v-on:') || replacement.text.startsWith('@');
					const isProp = replacement.text.startsWith('v-bind:') || replacement.text.startsWith(':');
					const isModel = replacement.text.startsWith('v-model:') || replacement.text.split('.')[0] === 'v-model';
					const hasModifier = replacement.text.includes('.');
					const validModifiers =
						isEvent ? eventModifiers
							: isProp ? propModifiers
								: undefined;
					const modifiers = replacement.text.split('.').slice(1);
					const textWithoutModifier = replacement.text.split('.')[0];

					if (validModifiers && hasModifier) {

						for (const modifier in validModifiers) {

							if (modifiers.includes(modifier)) {
								continue;
							}

							const modifierDes = validModifiers[modifier];
							const insertText = textWithoutModifier + modifiers.slice(0, -1).map(m => '.' + m).join('') + '.' + modifier;
							const newItem: html.CompletionItem = {
								label: modifier,
								filterText: insertText,
								documentation: {
									kind: 'markdown',
									value: modifierDes,
								},
								textEdit: {
									range: replacement.textEdit.range,
									newText: insertText,
								},
								kind: 20 satisfies typeof vscode.CompletionItemKind.EnumMember,
							};

							completionList.items.push(newItem);
						}
					}
					else if (hasModifier && isModel) {

						for (const modifier of modelData.globalAttributes ?? []) {

							if (modifiers.includes(modifier.name)) {
								continue;
							}

							const insertText = textWithoutModifier + modifiers.slice(0, -1).map(m => '.' + m).join('') + '.' + modifier.name;
							const newItem: html.CompletionItem = {
								label: modifier.name,
								filterText: insertText,
								documentation: {
									kind: 'markdown',
									value: (typeof modifier.description === 'object' ? modifier.description.value : modifier.description)
										+ '\n\n' + modifier.references?.map(ref => `[${ref.name}](${ref.url})`).join(' | '),
								},
								textEdit: {
									range: replacement.textEdit.range,
									newText: insertText,
								},
								kind: 20 satisfies typeof vscode.CompletionItemKind.EnumMember,
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

					if (item.kind === 10 satisfies typeof vscode.CompletionItemKind.Property && lastCompletionComponentNames.has(hyphenateTag(item.label))) {
						item.kind = 6 satisfies typeof vscode.CompletionItemKind.Variable;
						item.sortText = '\u0000' + (item.sortText ?? item.label);
					}
					else if (itemId && (itemId.type === 'componentProp' || itemId.type === 'componentEvent')) {

						const [componentName] = itemId.args;

						if (componentName !== '*') {
							if (
								item.label === 'class'
								|| item.label === 'ref'
								|| item.label.endsWith(':class')
								|| item.label.endsWith(':ref')
							) {
								item.sortText = '\u0000' + (item.sortText ?? item.label);
							}
							else {
								item.sortText = '\u0000\u0000' + (item.sortText ?? item.label);
							}
						}

						if (itemId.type === 'componentProp') {
							if (componentName !== '*') {
								item.kind = 5 satisfies typeof vscode.CompletionItemKind.Field;
							}
						}
						else {
							item.kind = componentName !== '*' ? 3 satisfies typeof vscode.CompletionItemKind.Function : 23 satisfies typeof vscode.CompletionItemKind.Event;
						}
					}
					else if (
						item.label === 'v-if'
						|| item.label === 'v-else-if'
						|| item.label === 'v-else'
						|| item.label === 'v-for'
					) {
						item.kind = 14 satisfies typeof vscode.CompletionItemKind.Keyword;
						item.sortText = '\u0003' + (item.sortText ?? item.label);
					}
					else if (item.label.startsWith('v-')) {
						item.kind = 3 satisfies typeof vscode.CompletionItemKind.Function;
						item.sortText = '\u0002' + (item.sortText ?? item.label);
					}
					else {
						item.sortText = '\u0001' + (item.sortText ?? item.label);
					}
				}

				updateExtraCustomData([]);
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

	function getScanner(service: LanguageServicePluginInstance, document: TextDocument) {
		if (mode === 'html') {
			return service.provide['html/languageService']().createScanner(document.getText());
		}
		else {
			const pugDocument = service.provide['pug/pugDocument'](document);
			if (pugDocument) {
				return service.provide['pug/languageService']().createScanner(pugDocument);
			}
		}
	}

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
};

function createInternalItemId(type: 'componentEvent' | 'componentProp', args: string[]) {
	return '__VLS_::' + type + '::' + args.join(',');
}

function readInternalItemId(key: string) {
	if (key.startsWith('__VLS_::')) {
		const strs = key.split('::');
		return {
			type: strs[1] as 'componentEvent' | 'componentProp',
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
