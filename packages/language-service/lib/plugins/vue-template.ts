import type { Disposable, LanguageServiceContext, LanguageServicePluginInstance } from '@volar/language-service';
import { VueCompilerOptions, VueVirtualCode, hyphenateAttr, hyphenateTag, parseScriptSetupRanges, tsCodegen } from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import { getComponentSpans } from '@vue/typescript-plugin/lib/common';
import { create as createHtmlService } from 'volar-service-html';
import { create as createPugService } from 'volar-service-pug';
import * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { URI, Utils } from 'vscode-uri';
import { getNameCasing } from '../ideFeatures/nameCasing';
import { AttrNameCasing, LanguageServicePlugin, TagNameCasing } from '../types';
import { loadModelModifiersData, loadTemplateData } from './data';

type InternalItemId =
	| 'componentEvent'
	| 'componentProp'
	| 'specialTag';

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
	ts: typeof import('typescript'),
	getTsPluginClient?: (context: LanguageServiceContext) => typeof import('@vue/typescript-plugin/lib/client') | undefined
): LanguageServicePlugin {
	let customData: html.IHTMLDataProvider[] = [];
	let extraCustomData: html.IHTMLDataProvider[] = [];
	let lastCompletionComponentNames = new Set<string>();

	const tsDocumentations = new Map<string, string>();
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
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false,
			},
			semanticTokensProvider: {
				legend: {
					tokenTypes: ['class'],
					tokenModifiers: [],
				},
			}
		},
		create(context) {
			const tsPluginClient = getTsPluginClient?.(context);
			const baseServiceInstance = baseService.create(context);

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
					text = text.slice('  - `.'.length);
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
					text = text.slice('  - `.'.length);
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

					if (!context.project.vue) {
						return;
					}
					const vueCompilerOptions = context.project.vue.compilerOptions;

					let sync: (() => Promise<number>) | undefined;
					let currentVersion: number | undefined;

					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					if (sourceScript?.generated?.root instanceof VueVirtualCode) {

						// #4298: Precompute HTMLDocument before provideHtmlData to avoid parseHTMLDocument requesting component names from tsserver
						baseServiceInstance.provideCompletionItems?.(document, position, completionContext, token);

						sync = (await provideHtmlData(vueCompilerOptions, sourceScript.id, sourceScript.generated.root)).sync;
						currentVersion = await sync();
					}

					let htmlComplete = await baseServiceInstance.provideCompletionItems?.(document, position, completionContext, token);
					while (currentVersion !== (currentVersion = await sync?.())) {
						htmlComplete = await baseServiceInstance.provideCompletionItems?.(document, position, completionContext, token);
					}
					if (!htmlComplete) {
						return;
					}

					if (sourceScript?.generated) {
						const virtualCode = sourceScript.generated.embeddedCodes.get('template');
						if (virtualCode) {
							const embeddedDocumentUri = context.encodeEmbeddedDocumentUri(sourceScript.id, virtualCode.id);
							afterHtmlCompletion(
								htmlComplete,
								context.documents.get(embeddedDocumentUri, virtualCode.languageId, virtualCode.snapshot)
							);
						}
					}

					return htmlComplete;
				},

				async provideInlayHints(document) {

					if (!isSupportedDocument(document)) {
						return;
					}

					if (!context.project.vue) {
						return;
					}
					const vueCompilerOptions = context.project.vue.compilerOptions;

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
								const checkTag = tagName.includes('.')
									? tagName
									: components.find(component => component === tagName || hyphenateTag(component) === tagName);
								if (checkTag) {
									componentProps[checkTag] ??= (await tsPluginClient?.getComponentProps(code.fileName, checkTag, true) ?? []).map(prop => prop.name);
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
										if (attrText.includes('.')) {
											attrText = attrText.split('.')[0];
										}
										// normalize
										if (attrText.startsWith('v-bind:')) {
											attrText = attrText.slice('v-bind:'.length);
										}
										else if (attrText.startsWith(':')) {
											attrText = attrText.slice(':'.length);
										}
										else if (attrText.startsWith('v-model:')) {
											attrText = attrText.slice('v-model:'.length);
										}
										else if (attrText === 'v-model') {
											attrText = vueCompilerOptions.target >= 3 ? 'modelValue' : 'value'; // TODO: support for experimentalModelPropName?
										}
										else if (attrText.startsWith('v-on:')) {
											attrText = 'on-' + hyphenateAttr(attrText.slice('v-on:'.length));
										}
										else if (attrText.startsWith('@')) {
											attrText = 'on-' + hyphenateAttr(attrText.slice('@'.length));
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
					const { template } = code._sfc;

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
					if (!context.project.vue) {
						return;
					}
					const vueCompilerOptions = context.project.vue.compilerOptions;
					const languageService = context.inject<(import('volar-service-typescript').Provide), 'typescript/languageService'>('typescript/languageService');
					if (!languageService) {
						return;
					}
					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					if (
						!sourceScript
						|| !(sourceScript.generated?.root instanceof VueVirtualCode)
						|| !sourceScript.generated.root._sfc.template
					) {
						return [];
					}
					const { template } = sourceScript.generated.root._sfc;
					const spans = getComponentSpans.call(
						{
							files: context.language.scripts,
							languageService,
							typescript: ts,
							vueOptions: vueCompilerOptions,
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

			async function provideHtmlData(vueCompilerOptions: VueCompilerOptions, sourceDocumentUri: URI, vueCode: VueVirtualCode) {

				await (initializing ??= initialize());

				const casing = await getNameCasing(context, sourceDocumentUri);

				if (builtInData.tags) {
					for (const tag of builtInData.tags) {
						if (isItemKey(tag.name)) {
							continue;
						}

						if (specialTags.has(tag.name)) {
							tag.name = generateItemKey('specialTag', tag.name, '');
						}
						else if (casing.tag === TagNameCasing.Kebab) {
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
					propsInfo: { name: string, commentMarkdown: string; }[];
					events: string[];
				}>();

				let version = 0;
				let components: string[] | undefined;
				let templateContextProps: string[] | undefined;

				tsDocumentations.clear();

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
							const scriptSetupRanges = vueCode._sfc.scriptSetup
								? parseScriptSetupRanges(ts, vueCode._sfc.scriptSetup.ast, vueCompilerOptions)
								: undefined;
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
								const name = vueCode._sfc.scriptSetup!.content.slice(binding.start, binding.end);
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
									const propsInfo = await tsPluginClient?.getComponentProps(vueCode.fileName, tag) ?? [];
									const events = await tsPluginClient?.getComponentEvents(vueCode.fileName, tag) ?? [];
									tagInfos.set(tag, {
										attrs,
										propsInfo: propsInfo.filter(prop =>
											!prop.name.startsWith('ref_')
										),
										events,
									});
									version++;
								})());
								return [];
							}

							const { attrs, propsInfo, events } = tagInfo;
							const props = propsInfo.map(prop => prop.name);
							const attributes: html.IAttributeData[] = [];
							const _tsCodegen = tsCodegen.get(vueCode._sfc);

							if (_tsCodegen) {
								if (!templateContextProps) {
									promises.push((async () => {
										templateContextProps = await tsPluginClient?.getTemplateContextProps(vueCode.fileName) ?? [];
										version++;
									})());
									return [];
								}
								let ctxVars = [
									..._tsCodegen.scriptRanges.get()?.bindings.map(binding => vueCode._sfc.script!.content.slice(binding.start, binding.end)) ?? [],
									..._tsCodegen.scriptSetupRanges.get()?.bindings.map(binding => vueCode._sfc.scriptSetup!.content.slice(binding.start, binding.end)) ?? [],
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

								const isEvent = hyphenateAttr(name).startsWith('on-');

								if (isEvent) {

									const propNameBase = name.startsWith('on-')
										? name.slice('on-'.length)
										: (name['on'.length].toLowerCase() + name.slice('onX'.length));
									const propKey = generateItemKey('componentEvent', isGlobal ? '*' : tag, propNameBase);

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
								else {

									const propName = name;
									const propKey = generateItemKey('componentProp', isGlobal ? '*' : tag, propName);
									const propDescription = propsInfo.find(prop => {
										const name = casing.attr === AttrNameCasing.Camel ? prop.name : hyphenateAttr(prop.name);
										return name === propName;
									})?.commentMarkdown;

									if (propDescription) {
										tsDocumentations.set(propName, propDescription);
									}

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
								const propKey = generateItemKey('componentEvent', tag, name);

								attributes.push(
									{
										name: 'v-on:' + name,
										description: propKey,
									},
									{
										name: '@' + name,
										description: propKey,
									}
								);
							}

							const models: [boolean, string][] = [];

							for (const prop of [...props, ...attrs]) {
								if (prop.startsWith('onUpdate:')) {
									const isGlobal = !propsSet.has(prop);
									models.push([isGlobal, prop.slice('onUpdate:'.length)]);
								}
							}
							for (const event of events) {
								if (event.startsWith('update:')) {
									models.push([false, event.slice('update:'.length)]);
								}
							}

							for (const [isGlobal, model] of models) {

								const name = casing.attr === AttrNameCasing.Camel ? model : hyphenateAttr(model);
								const propKey = generateItemKey('componentProp', isGlobal ? '*' : tag, name);

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

			function afterHtmlCompletion(completionList: vscode.CompletionList, document: TextDocument) {

				const replacement = getReplacement(completionList, document);

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

				completionList.items = completionList.items.filter(item => !specialTags.has(parseLabel(item.label).name));

				const htmlDocumentations = new Map<string, string>();

				for (const item of completionList.items) {
					const documentation = typeof item.documentation === 'string' ? item.documentation : item.documentation?.value;
					if (documentation && !isItemKey(documentation) && item.documentation) {
						htmlDocumentations.set(item.label, documentation);
					}
				}

				for (const item of completionList.items) {
					const parsedLabelKey = parseItemKey(item.label);

					if (parsedLabelKey) {
						const name = parsedLabelKey.tag;
						item.label = parsedLabelKey.leadingSlash ? '/' + name : name;

						const text = parsedLabelKey.leadingSlash ? `/${name}>` : name;
						if (item.textEdit) {
							item.textEdit.newText = text;
						};
						if (item.insertText) {
							item.insertText = text;
						}
						if (item.sortText) {
							item.sortText = text;
						}
					}

					const itemKeyStr = typeof item.documentation === 'string' ? item.documentation : item.documentation?.value;

					let parsedItemKey = itemKeyStr ? parseItemKey(itemKeyStr) : undefined;
					if (parsedItemKey) {
						const documentations: string[] = [];

						if (tsDocumentations.has(parsedItemKey.prop)) {
							documentations.push(tsDocumentations.get(parsedItemKey.prop)!);
						}

						let { isEvent, propName } = getPropName(parsedItemKey);
						if (isEvent) {
							// click -> onclick
							propName = 'on' + propName;
						}
						if (htmlDocumentations.has(propName)) {
							documentations.push(htmlDocumentations.get(propName)!);
						}

						if (documentations.length) {
							item.documentation = {
								kind: 'markdown',
								value: documentations.join('\n\n'),
							};
						}
						else {
							item.documentation = undefined;
						}
					}
					else {
						let propName = item.label;

						for (const str of ['v-bind:', ':']) {
							if (propName.startsWith(str) && propName !== str) {
								propName = propName.slice(str.length);
								break;
							}
						}

						// for special props without internal item key
						if (specialProps.has(propName)) {
							parsedItemKey = {
								type: 'componentProp',
								tag: '^',
								prop: propName,
								leadingSlash: false
							};
						}

						if (tsDocumentations.has(propName)) {
							const originalDocumentation = typeof item.documentation === 'string' ? item.documentation : item.documentation?.value;
							item.documentation = {
								kind: 'markdown',
								value: [
									tsDocumentations.get(propName)!,
									originalDocumentation,
								].filter(str => !!str).join('\n\n'),
							};
						}
					}

					const tokens: string[] = [];

					if (
						item.kind === 10 satisfies typeof vscode.CompletionItemKind.Property
						&& lastCompletionComponentNames.has(hyphenateTag(item.label))
					) {
						item.kind = 6 satisfies typeof vscode.CompletionItemKind.Variable;
						tokens.push('\u0000');
					}
					else if (parsedItemKey) {

						const isComponent = parsedItemKey.tag !== '*';
						const { isEvent, propName } = getPropName(parsedItemKey);

						if (parsedItemKey.type === 'componentProp') {
							if (isComponent || specialProps.has(propName)) {
								item.kind = 5 satisfies typeof vscode.CompletionItemKind.Field;
							}
						}
						else if (isEvent) {
							item.kind = 23 satisfies typeof vscode.CompletionItemKind.Event;
							if (propName.startsWith('vnode-')) {
								tokens.push('\u0004');
							}
						}

						if (isComponent || specialProps.has(propName)) {
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
						item.kind = 14 satisfies typeof vscode.CompletionItemKind.Keyword;
						tokens.push('\u0003');
					}
					else if (item.label.startsWith('v-')) {
						item.kind = 3 satisfies typeof vscode.CompletionItemKind.Function;
						tokens.push('\u0002');
					}
					else {
						tokens.push('\u0001');
					}

					item.sortText = tokens.join('') + (item.sortText ?? item.label);
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

function parseLabel(label: string) {
	const leadingSlash = label.startsWith('/');
	const name = label.slice(leadingSlash ? 1 : 0);
	return {
		name,
		leadingSlash
	}
}

function generateItemKey(type: InternalItemId, tag: string, prop: string) {
	return '__VLS_data=' + type + ',' + tag + ',' + prop;
}

function isItemKey(key: string) {
	return key.startsWith('__VLS_data=');
}

function parseItemKey(key: string) {
	const { leadingSlash, name } = parseLabel(key);
	if (isItemKey(name)) {
		const strs = name.slice('__VLS_data='.length).split(',');
		return {
			type: strs[0] as InternalItemId,
			tag: strs[1],
			prop: strs[2],
			leadingSlash
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

function getPropName(
	itemKey: ReturnType<typeof parseItemKey> & {}
) {
	const name = hyphenateAttr(itemKey.prop);
	if (name.startsWith('on-')) {
		return { isEvent: true, propName: name.slice('on-'.length) };
	}
	else if (itemKey.type === 'componentEvent') {
		return { isEvent: true, propName: name };
	}
	return { isEvent: false, propName: name };
}
