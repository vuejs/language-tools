import * as createHtmlPlugin from '@volar-plugins/html';
import { FileRangeCapabilities, LanguageServicePlugin, SourceMapWithDocuments } from '@volar/language-service';
import * as vue from '@volar/vue-language-core';
import { hyphenate, capitalize, camelize } from '@vue/shared';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { checkComponentNames, checkEventsOfTag, checkPropsOfTag, getElementAttrs } from '../helpers';
import * as casing from '../ideFeatures/nameCasing';
import { AttrNameCasing, VueCompilerOptions, TagNameCasing } from '../types';
import { loadTemplateData, loadModelModifiersData } from './data';

let builtInData: html.HTMLDataV1;
let modelData: html.HTMLDataV1;

export default function useVueTemplateLanguagePlugin<T extends ReturnType<typeof createHtmlPlugin>>(options: {
	getScanner(document: TextDocument, t: ReturnType<T>): html.Scanner | undefined,
	templateLanguagePlugin: T,
	isSupportedDocument: (document: TextDocument) => boolean,
	vueCompilerOptions: VueCompilerOptions,
}): T {

	const plugin: LanguageServicePlugin = (_context) => {

		if (!_context.typescript)
			return {};

		builtInData ??= loadTemplateData(_context.env.locale ?? 'en');
		modelData ??= loadModelModifiersData(_context.env.locale ?? 'en');

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

		const _ts = _context.typescript;
		const nativeTags = new Set(options.vueCompilerOptions.nativeTags);
		const templatePlugin = options.templateLanguagePlugin(_context);

		return {

			...templatePlugin,

			complete: {

				triggerCharacters: [
					...templatePlugin.complete?.triggerCharacters ?? [],
					'@', // vue event shorthand
				],

				async on(document, position, context) {

					if (!options.isSupportedDocument(document))
						return;

					for (const [_, map] of _context.documents.getMapsByVirtualFileUri(document.uri)) {
						const virtualFile = _context.documents.getSourceByUri(map.sourceFileDocument.uri)?.root;
						if (virtualFile && virtualFile instanceof vue.VueFile) {
							await provideHtmlData(map, virtualFile);
						}
					}

					const htmlComplete = await templatePlugin.complete?.on?.(document, position, context);
					if (!htmlComplete)
						return;

					for (const [_, map] of _context.documents.getMapsByVirtualFileUri(document.uri)) {
						const virtualFile = _context.documents.getSourceByUri(map.sourceFileDocument.uri)?.root;
						if (virtualFile && virtualFile instanceof vue.VueFile) {
							afterHtmlCompletion(htmlComplete, map, virtualFile);
						}
					}

					return htmlComplete;
				},
			},

			inlayHints: {
				async on(document) {

					if (!options.isSupportedDocument(document))
						return;

					const enabled = await _context.env.configurationHost?.getConfiguration<boolean>('volar.inlayHints.missingRequiredProps') ?? true;
					if (!enabled)
						return;

					const result: vscode.InlayHint[] = [];

					for (const [_, map] of _context.documents.getMapsByVirtualFileUri(document.uri)) {
						const virtualFile = _context.documents.getSourceByUri(map.sourceFileDocument.uri)?.root;
						const scanner = options.getScanner(document, templatePlugin as ReturnType<T>);
						if (virtualFile && virtualFile instanceof vue.VueFile && scanner) {
							const casing = await getNameCasing(map.sourceFileDocument.uri);
							const components = checkComponentNames(_ts.module, _ts.languageService, virtualFile);
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
									const component = components.find(component => component === tagName || hyphenate(component) === tagName);
									if (component) {
										componentProps[component] ??= checkPropsOfTag(_ts.module, _ts.languageService, virtualFile, component, true);
										current = {
											unburnedRequiredProps: [...componentProps[component]],
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
												attrText = 'modelValue'; // TODO: support for experimentalModelPropName?
											}

											current.unburnedRequiredProps = current.unburnedRequiredProps.filter(propName => {
												return attrText !== propName
													&& attrText !== hyphenate(propName);
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
												kind: vscode.InlayHintKind.Parameter,
												textEdits: [{
													range: {
														start: document.positionAt(current.insertOffset),
														end: document.positionAt(current.insertOffset),
													},
													newText: ` :${casing.attr === AttrNameCasing.Kebab ? hyphenate(requiredProp) : requiredProp}=""`,
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
					}

					return result;
				},
			},

			doHover(document, position) {

				if (!options.isSupportedDocument(document))
					return;

				if (_context.documents.hasVirtualFileByUri(document.uri))
					templatePlugin.updateCustomData([]);

				return templatePlugin.doHover?.(document, position);
			},

			validation: {
				async onSyntactic(document) {

					if (!options.isSupportedDocument(document))
						return;

					const originalResult = await templatePlugin.validation?.onSyntactic?.(document);

					for (const [_, map] of _context.documents.getMapsByVirtualFileUri(document.uri)) {

						const virtualFile = _context.documents.getSourceByUri(map.sourceFileDocument.uri)?.root;
						if (!virtualFile || !(virtualFile instanceof vue.VueFile))
							continue;

						const templateErrors: vscode.Diagnostic[] = [];
						const sfcVueTemplateCompiled = virtualFile.compiledSFCTemplate;

						if (sfcVueTemplateCompiled) {

							for (const error of sfcVueTemplateCompiled.errors) {
								onCompilerError(error, vscode.DiagnosticSeverity.Error);
							}

							for (const warning of sfcVueTemplateCompiled.warnings) {
								onCompilerError(warning, vscode.DiagnosticSeverity.Warning);
							}

							function onCompilerError(error: NonNullable<typeof sfcVueTemplateCompiled>['errors'][number], severity: vscode.DiagnosticSeverity) {

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
					}
				},
			},

			async findDocumentSemanticTokens(document, range, legend) {

				if (!options.isSupportedDocument(document))
					return;

				const result = await templatePlugin.findDocumentSemanticTokens?.(document, range, legend) ?? [];
				const scanner = options.getScanner(document, templatePlugin as ReturnType<T>);
				if (!scanner)
					return;

				for (const [_, map] of _context.documents.getMapsByVirtualFileUri(document.uri)) {

					const virtualFile = _context.documents.getSourceByUri(map.sourceFileDocument.uri)?.root;
					if (!virtualFile || !(virtualFile instanceof vue.VueFile))
						continue;

					const templateScriptData = checkComponentNames(_ts.module, _ts.languageService, virtualFile);
					const components = new Set([
						...templateScriptData,
						...templateScriptData.map(hyphenate).filter(name => !nativeTags.has(name)),
					]);
					const offsetRange = {
						start: document.offsetAt(range.start),
						end: document.offsetAt(range.end),
					};

					let token = scanner.scan();

					while (token !== html.TokenType.EOS) {

						const tokenOffset = scanner.getTokenOffset();

						// TODO: fix source map perf and break in while condition
						if (tokenOffset > offsetRange.end)
							break;

						if (tokenOffset >= offsetRange.start && (token === html.TokenType.StartTag || token === html.TokenType.EndTag)) {

							const tokenText = scanner.getTokenText();

							if (components.has(tokenText) || tokenText.indexOf('.') >= 0) {

								const tokenLength = scanner.getTokenLength();
								const tokenPosition = document.positionAt(tokenOffset);

								if (components.has(tokenText)) {
									let tokenType = legend.tokenTypes.indexOf('component');
									if (tokenType === -1) {
										tokenType = legend.tokenTypes.indexOf('class');
									}
									result.push([tokenPosition.line, tokenPosition.character, tokenLength, tokenType, 0]);
								}
							}
						}
						token = scanner.scan();
					}
				}

				return result;
			},
		};

		async function provideHtmlData(map: SourceMapWithDocuments<FileRangeCapabilities>, vueSourceFile: vue.VueFile) {

			const casing = await getNameCasing(map.sourceFileDocument.uri);

			if (builtInData.tags) {
				for (const tag of builtInData.tags) {
					if (tag.name === 'slot')
						continue;
					if (tag.name === 'component')
						continue;
					if (tag.name === 'template')
						continue;
					if (casing.tag === TagNameCasing.Kebab) {
						tag.name = hyphenate(tag.name);
					}
					else {
						tag.name = camelize(capitalize(tag.name));
					}
				}
			}

			templatePlugin.updateCustomData([
				html.newHTMLDataProvider('vue-template-built-in', builtInData),
				{
					getId: () => 'vue-template',
					isApplicable: () => true,
					provideTags: () => {

						const components = checkComponentNames(_ts.module, _ts.languageService, vueSourceFile)
							.filter(name =>
								name !== 'Transition'
								&& name !== 'TransitionGroup'
								&& name !== 'KeepAlive'
								&& name !== 'Suspense'
								&& name !== 'Teleport'
							);
						const scriptSetupRanges = vueSourceFile.sfc.scriptSetupAst ? vue.parseScriptSetupRanges(_ts.module, vueSourceFile.sfc.scriptSetupAst, options.vueCompilerOptions) : undefined;
						const names = new Set<string>();
						const tags: html.ITagData[] = [];

						for (const tag of components) {
							if (casing.tag === TagNameCasing.Kebab) {
								names.add(hyphenate(tag));
							}
							else if (casing.tag === TagNameCasing.Pascal) {
								names.add(tag);
							}
						}

						for (const binding of scriptSetupRanges?.bindings ?? []) {
							const name = vueSourceFile.sfc.scriptSetup!.content.substring(binding.start, binding.end);
							if (casing.tag === TagNameCasing.Kebab) {
								names.add(hyphenate(name));
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
					provideAttributes: (tag) => {

						const attrs = getElementAttrs(_ts.module, _ts.languageService, vueSourceFile.fileName, tag);
						const props = new Set(checkPropsOfTag(_ts.module, _ts.languageService, vueSourceFile, tag));
						const events = checkEventsOfTag(_ts.module, _ts.languageService, vueSourceFile, tag);
						const attributes: html.IAttributeData[] = [];

						for (const prop of [...props, ...attrs]) {

							const isGlobal = !props.has(prop);
							const name = casing.attr === AttrNameCasing.Camel ? prop : hyphenate(prop);

							if (hyphenate(name).startsWith('on-')) {

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
									},
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
									},
								);
							}
						}

						for (const event of events) {

							const name = casing.attr === AttrNameCasing.Camel ? event : hyphenate(event);
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
								const isGlobal = !props.has(prop);
								models.push([isGlobal, prop.substring('onUpdate:'.length)]);
							}
						}
						for (const event of events) {
							if (event.startsWith('update:')) {
								models.push([false, event.substring('update:'.length)]);
							}
						}

						for (const [isGlobal, model] of models) {

							const name = casing.attr === AttrNameCasing.Camel ? model : hyphenate(model);
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
		}

		async function getNameCasing(uri: string) {

			const detected = casing.detect(_context, _ts, uri);
			const [attr, tag] = await Promise.all([
				_context.env.configurationHost?.getConfiguration<'auto-kebab' | 'auto-camel' | 'kebab' | 'camel'>('volar.completion.preferredAttrNameCase', uri),
				_context.env.configurationHost?.getConfiguration<'auto-kebab' | 'auto-pascal' | 'kebab' | 'pascal'>('volar.completion.preferredTagNameCase', uri),
			]);
			const tagNameCasing = detected.tag.length === 1 && (tag === 'auto-pascal' || tag === 'auto-kebab') ? detected.tag[0] : (tag === 'auto-kebab' || tag === 'kebab') ? TagNameCasing.Kebab : TagNameCasing.Pascal;
			const attrNameCasing = detected.attr.length === 1 && (attr === 'auto-camel' || attr === 'auto-kebab') ? detected.attr[0] : (attr === 'auto-camel' || attr === 'camel') ? AttrNameCasing.Camel : AttrNameCasing.Kebab;

			return {
				tag: tagNameCasing,
				attr: attrNameCasing,
			};
		}

		function afterHtmlCompletion(completionList: vscode.CompletionList, map: SourceMapWithDocuments<FileRangeCapabilities>, vueSourceFile: vue.VueFile) {

			const replacement = getReplacement(completionList, map.sourceFileDocument);
			const componentNames = new Set(checkComponentNames(_ts.module, _ts.languageService, vueSourceFile).map(hyphenate));

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

						if (modifiers.includes(modifier))
							continue;

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
							kind: vscode.CompletionItemKind.EnumMember,
						};

						completionList.items.push(newItem);
					}
				}
				else if (hasModifier && isModel) {

					for (const modifier of modelData.globalAttributes ?? []) {

						if (modifiers.includes(modifier.name))
							continue;

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

				if (itemIdKey && itemId) {

					if (itemId.type === 'componentProp' || itemId.type === 'componentEvent') {

						const [componentName] = itemId.args;

						if (componentName !== '*') {
							item.sortText = '\u0000' + (item.sortText ?? item.label);
						}

						if (itemId.type === 'componentProp') {
							if (componentName !== '*') {
								item.kind = vscode.CompletionItemKind.Field;
							}
						}
						else {
							item.kind = componentName !== '*' ? vscode.CompletionItemKind.Function : vscode.CompletionItemKind.Event;
						}
					}
					else if (
						item.label === 'v-if'
						|| item.label === 'v-else-if'
						|| item.label === 'v-else'
						|| item.label === 'v-for'
					) {
						item.kind = vscode.CompletionItemKind.Method;
						item.sortText = '\u0003' + (item.sortText ?? item.label);
					}
					else if (item.label.startsWith('v-')) {
						item.kind = vscode.CompletionItemKind.Function;
						item.sortText = '\u0002' + (item.sortText ?? item.label);
					}
					else {
						item.sortText = '\u0001' + (item.sortText ?? item.label);
					}
				}
				else if (item.kind === vscode.CompletionItemKind.Property && componentNames.has(hyphenate(item.label))) {
					item.kind = vscode.CompletionItemKind.Variable;
					item.sortText = '\u0000' + (item.sortText ?? item.label);
				}
			}

			templatePlugin.updateCustomData([]);
		}
	};

	return plugin as T;
}

function createInternalItemId(type: 'vueDirective' | 'componentEvent' | 'componentProp', args: string[]) {
	return '__VLS_::' + type + '::' + args.join(',');
}

function readInternalItemId(key: string) {
	if (key.startsWith('__VLS_::')) {
		const strs = key.split('::');
		return {
			type: strs[1] as 'vueDirective' | 'componentEvent' | 'componentProp',
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
