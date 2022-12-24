import useHtmlPlugin from '@volar-plugins/html';
import { LanguageServicePlugin, LanguageServicePluginContext, LanguageServiceRuntimeContext, FileRangeCapabilities, SourceMapWithDocuments } from '@volar/language-service';
import * as vue from '@volar/vue-language-core';
import { hyphenate } from '@vue/shared';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { checkComponentNames, checkEventsOfTag, checkPropsOfTag, getElementAttrs } from '../helpers';
import * as casing from '../ideFeatures/nameCasing';
import { AttrNameCasing, TagNameCasing } from '../types';

const globalDirectives = html.newHTMLDataProvider('vue-global-directive', {
	version: 1.1,
	tags: [],
	globalAttributes: [
		{ name: 'v-if' },
		{ name: 'v-else-if' },
		{ name: 'v-else', valueSet: 'v' },
		{ name: 'v-for' },
	],
});
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

export default function useVueTemplateLanguagePlugin<T extends ReturnType<typeof useHtmlPlugin>>(options: {
	getScanner(document: TextDocument): html.Scanner | undefined,
	templateLanguagePlugin: T,
	isSupportedDocument: (document: TextDocument) => boolean,
	vueLsHost: vue.LanguageServiceHost,
	context: LanguageServiceRuntimeContext,
}): LanguageServicePlugin & T {

	const vueCompilerOptions = vue.resolveVueCompilerOptions(options.vueLsHost.getVueCompilationSettings());
	const nativeTags = new Set(vueCompilerOptions.nativeTags);

	let context: LanguageServicePluginContext;

	return {

		...options.templateLanguagePlugin,

		setup(_context) {
			options.templateLanguagePlugin.setup?.(_context);
			context = _context;
		},

		complete: {

			triggerCharacters: [
				...options.templateLanguagePlugin.complete?.triggerCharacters ?? [],
				'@', // vue event shorthand
			],

			async on(document, position, context) {

				if (!options.isSupportedDocument(document))
					return;

				for (const [_, map] of options.context.documents.getMapsByVirtualFileUri(document.uri)) {
					const virtualFile = options.context.documents.getRootFileBySourceFileUri(map.sourceFileDocument.uri);
					if (virtualFile && virtualFile instanceof vue.VueFile) {
						await provideHtmlData(map, virtualFile);
					}
				}

				const htmlComplete = await options.templateLanguagePlugin.complete?.on?.(document, position, context);
				if (!htmlComplete)
					return;

				for (const [_, map] of options.context.documents.getMapsByVirtualFileUri(document.uri)) {
					const virtualFile = options.context.documents.getRootFileBySourceFileUri(map.sourceFileDocument.uri);
					if (virtualFile && virtualFile instanceof vue.VueFile) {
						afterHtmlCompletion(htmlComplete, map, virtualFile);
					}
				}

				return htmlComplete;
			},
		},

		doHover(document, position) {

			if (!options.isSupportedDocument(document))
				return;

			if (options.context.documents.getVirtualFileByUri(document.uri))
				options.templateLanguagePlugin.updateCustomData([]);

			return options.templateLanguagePlugin.doHover?.(document, position);
		},

		validation: {
			async onSyntactic(document) {

				if (!options.isSupportedDocument(document))
					return;

				const originalResult = await options.templateLanguagePlugin.validation?.onSyntactic?.(document);

				for (const [_, map] of options.context.documents.getMapsByVirtualFileUri(document.uri)) {

					const virtualFile = options.context.documents.getRootFileBySourceFileUri(map.sourceFileDocument.uri);
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

			const result = await options.templateLanguagePlugin.findDocumentSemanticTokens?.(document, range, legend) ?? [];
			const scanner = options.getScanner(document);
			if (!scanner)
				return;

			for (const [_, map] of options.context.documents.getMapsByVirtualFileUri(document.uri)) {

				const virtualFile = options.context.documents.getRootFileBySourceFileUri(map.sourceFileDocument.uri);
				if (!virtualFile || !(virtualFile instanceof vue.VueFile))
					continue;

				const templateScriptData = checkComponentNames(context.typescript.module, context.typescript.languageService, virtualFile);
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
								result.push([tokenPosition.line, tokenPosition.character, tokenLength, legend.tokenTypes.indexOf('class'), 0]);
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

		const detected = casing.detect(options.context, map.sourceFileDocument.uri);
		const [attr, tag] = await Promise.all([
			context.env.configurationHost?.getConfiguration<'auto-kebab' | 'auto-camel' | 'kebab' | 'camel'>('volar.completion.preferredAttrNameCase', map.sourceFileDocument.uri),
			context.env.configurationHost?.getConfiguration<'auto-kebab' | 'auto-pascal' | 'kebab' | 'pascal'>('volar.completion.preferredTagNameCase', map.sourceFileDocument.uri),
		]);
		const tagNameCasing = detected.tag.length === 1 && (tag === 'auto-pascal' || tag === 'auto-kebab') ? detected.tag[0] : (tag === 'auto-kebab' || tag === 'kebab') ? TagNameCasing.Kebab : TagNameCasing.Pascal;
		const attrNameCasing = detected.attr.length === 1 && (attr === 'auto-camel' || attr === 'auto-kebab') ? detected.attr[0] : (attr === 'auto-camel' || attr === 'camel') ? AttrNameCasing.Camel : AttrNameCasing.Kebab;

		options.templateLanguagePlugin.updateCustomData([
			globalDirectives,
			{
				getId: () => 'vue-template',
				isApplicable: () => true,
				provideTags: () => {

					const components = checkComponentNames(context.typescript.module, context.typescript.languageService, vueSourceFile);
					const scriptSetupRanges = vueSourceFile.sfc.scriptSetupAst ? vue.parseScriptSetupRanges(context.typescript.module, vueSourceFile.sfc.scriptSetupAst) : undefined;
					const names = new Set<string>();
					const tags: html.ITagData[] = [];

					for (const tag of components) {
						if (tagNameCasing === TagNameCasing.Kebab) {
							names.add(hyphenate(tag));
						}
						else if (tagNameCasing === TagNameCasing.Pascal) {
							names.add(tag);
						}
					}

					for (const binding of scriptSetupRanges?.bindings ?? []) {
						const name = vueSourceFile.sfc.scriptSetup!.content.substring(binding.start, binding.end);
						if (tagNameCasing === TagNameCasing.Kebab) {
							names.add(hyphenate(name));
						}
						else if (tagNameCasing === TagNameCasing.Pascal) {
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

					const attrs = getElementAttrs(context.typescript.module, context.typescript.languageService, vueSourceFile.fileName, tag);
					const props = new Set(checkPropsOfTag(context.typescript.module, context.typescript.languageService, vueSourceFile, tag));
					const events = checkEventsOfTag(context.typescript.module, context.typescript.languageService, vueSourceFile, tag);
					const attributes: html.IAttributeData[] = [];

					for (const prop of [...props, ...attrs]) {

						const isGlobal = !props.has(prop);
						const name = attrNameCasing === AttrNameCasing.Camel ? prop : hyphenate(prop);

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

						const name = attrNameCasing === AttrNameCasing.Camel ? event : hyphenate(event);
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

						const name = attrNameCasing === AttrNameCasing.Camel ? model : hyphenate(model);
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

	function afterHtmlCompletion(completionList: vscode.CompletionList, map: SourceMapWithDocuments<FileRangeCapabilities>, vueSourceFile: vue.VueFile) {

		const replacement = getReplacement(completionList, map.sourceFileDocument);
		const componentNames = new Set(checkComponentNames(context.typescript.module, context.typescript.languageService, vueSourceFile).map(hyphenate));

		if (replacement) {

			const isEvent = replacement.text.startsWith('@') || replacement.text.startsWith('v-on:');
			const hasModifier = replacement.text.includes('.');

			if (isEvent && hasModifier) {

				const modifiers = replacement.text.split('.').slice(1);
				const textWithoutModifier = replacement.text.split('.')[0];

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

		options.templateLanguagePlugin.updateCustomData([]);
	}
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
