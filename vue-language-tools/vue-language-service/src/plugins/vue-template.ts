import useHtmlPlugin from '@volar-plugins/html';
import { LanguageServicePlugin, LanguageServiceRuntimeContext, LanguageServicePluginContext, SourceFileDocument } from '@volar/language-service';
import * as shared from '@volar/shared';
import { getFormatCodeSettings } from '@volar-plugins/typescript/out/configs/getFormatCodeSettings';
import { getUserPreferences } from '@volar-plugins/typescript/out/configs/getUserPreferences';
import * as vue from '@volar/vue-language-core';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { posix as path } from 'path';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { checkComponentNames, checkEventsOfTag, checkGlobalAttrs, checkPropsOfTag } from '../helpers';
import * as casing from '../ideFeatures/nameCasing';
import { AttrNameCasing, TagNameCasing } from '../types';

export const semanticTokenTypes = [
	'componentTag',
];

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

interface AutoImportCompletionData {
	mode: 'autoImport',
	vueDocumentUri: string,
	importUri: string,
}

export default function useVueTemplateLanguagePlugin<T extends ReturnType<typeof useHtmlPlugin>>(options: {
	getSemanticTokenLegend(): vscode.SemanticTokensLegend,
	getScanner(document: TextDocument): html.Scanner | undefined,
	templateLanguagePlugin: T,
	isSupportedDocument: (document: TextDocument) => boolean,
	vueLsHost: vue.LanguageServiceHost,
	context: LanguageServiceRuntimeContext,
}): LanguageServicePlugin & T {

	const autoImportPositions = new WeakSet<vscode.Position>();
	const tokenTypes = new Map(options.getSemanticTokenLegend().tokenTypes.map((t, i) => [t, i]));
	const runtimeMode = vue.resolveVueCompilerOptions(options.vueLsHost.getVueCompilationSettings()).experimentalRuntimeMode;

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

				const vueDocument = options.context.documents.fromEmbeddedDocument(document);

				if (vueDocument) {
					await provideHtmlData(vueDocument);
				}

				const htmlComplete = await options.templateLanguagePlugin.complete?.on?.(document, position, context);

				if (!htmlComplete)
					return;

				if (vueDocument) {
					afterHtmlCompletion(htmlComplete, vueDocument);
				}

				return htmlComplete;
			},

			async resolve(item) {

				const data: AutoImportCompletionData | undefined = item.data;

				if (data?.mode === 'autoImport') {
					return await resolveAutoImportItem(item, data);
				}

				return item;
			},
		},

		doHover(document, position) {

			if (!options.isSupportedDocument(document))
				return;

			const vueDocument = options.context.documents.fromEmbeddedDocument(document);
			if (vueDocument) {
				options.templateLanguagePlugin.updateCustomData([]);
			}
			return options.templateLanguagePlugin.doHover?.(document, position);
		},

		validation: {
			async onSyntactic(document) {

				if (!options.isSupportedDocument(document))
					return;

				const originalResult = await options.templateLanguagePlugin.validation?.onSyntactic?.(document);
				const vueDocument = options.context.documents.fromEmbeddedDocument(document);

				if (vueDocument) {

					if (!(vueDocument?.file instanceof vue.VueSourceFile))
						return;

					const templateErrors: vscode.Diagnostic[] = [];
					const sfcVueTemplateCompiled = vueDocument.file.compiledSFCTemplate;

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

		async findDocumentSemanticTokens(document, range) {

			if (!options.isSupportedDocument(document))
				return;

			const result = await options.templateLanguagePlugin.findDocumentSemanticTokens?.(document, range) ?? [];
			const vueDocument = options.context.documents.fromEmbeddedDocument(document);
			const scanner = options.getScanner(document);

			if (vueDocument && scanner) {

				if (!(vueDocument.file instanceof vue.VueSourceFile))
					return;

				const templateScriptData = checkComponentNames(context.typescript.module, context.typescript.languageService, vueDocument.file);
				const components = new Set([
					...templateScriptData,
					...templateScriptData.map(hyphenate).filter(name => !vue.isIntrinsicElement(runtimeMode, name)),
				]);
				const offsetRange = range ? {
					start: document.offsetAt(range.start),
					end: document.offsetAt(range.end),
				} : {
					start: 0,
					end: document.getText().length,
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
								result.push([tokenPosition.line, tokenPosition.character, tokenLength, tokenTypes.get('componentTag') ?? -1, 0]);
							}
						}
					}
					token = scanner.scan();
				}
			}

			return result;
		},

		resolveEmbeddedRange(range) {
			if (autoImportPositions.has(range.start) && autoImportPositions.has(range.end))
				return range;
		},
	};

	async function resolveAutoImportItem(item: vscode.CompletionItem, data: AutoImportCompletionData) {

		const ts = context.typescript.module;

		const _vueDocument = options.context.documents.get(data.vueDocumentUri);
		if (!_vueDocument)
			return item;

		if (!(_vueDocument.file instanceof vue.VueSourceFile))
			return item;

		const vueSourceFile = _vueDocument.file;
		const vueDocument = _vueDocument;
		const importFile = shared.getPathOfUri(data.importUri);
		const rPath = path.relative(options.vueLsHost.getCurrentDirectory(), importFile);
		const sfc = vueSourceFile.sfc;

		let importPath = path.relative(path.dirname(data.vueDocumentUri), data.importUri);
		if (!importPath.startsWith('.')) {
			importPath = './' + importPath;
		}

		if (!sfc.scriptSetup && !sfc.script) {
			item.detail = `Auto import from '${importPath}'\n\n${rPath}`;
			item.documentation = {
				kind: vscode.MarkupKind.Markdown,
				value: '[Error] `<script>` / `<script setup>` block not found.',
			};
			return item;
		}

		item.labelDetails = { description: rPath };

		const scriptImport = sfc.scriptAst ? getLastImportNode(sfc.scriptAst) : undefined;
		const scriptSetupImport = sfc.scriptSetupAst ? getLastImportNode(sfc.scriptSetupAst) : undefined;
		const componentName = capitalize(camelize(item.label.replace(/\./g, '-')));
		const textDoc = vueDocument.getDocument();
		const insert = await getTypeScriptInsert() ?? getMonkeyInsert();
		if (insert.description) {
			item.detail = insert.description + '\n\n' + rPath;
		}
		if (sfc.scriptSetup) {
			const editPosition = textDoc.positionAt(sfc.scriptSetup.startTagEnd + (scriptSetupImport ? scriptSetupImport.end : 0));
			autoImportPositions.add(editPosition);
			item.additionalTextEdits = [
				vscode.TextEdit.insert(
					editPosition,
					'\n' + insert.insertText,
				),
			];
		}
		else if (sfc.script && sfc.scriptAst) {
			const editPosition = textDoc.positionAt(sfc.script.startTagEnd + (scriptImport ? scriptImport.end : 0));
			autoImportPositions.add(editPosition);
			item.additionalTextEdits = [
				vscode.TextEdit.insert(
					editPosition,
					'\n' + insert.insertText,
				),
			];
			const _scriptRanges = vue.scriptRanges.parseScriptRanges(ts, sfc.scriptAst, !!sfc.scriptSetup, true);
			const exportDefault = _scriptRanges.exportDefault;
			if (exportDefault) {
				// https://github.com/microsoft/TypeScript/issues/36174
				const printer = ts.createPrinter();
				if (exportDefault.componentsOption && exportDefault.componentsOptionNode) {
					const newNode: typeof exportDefault.componentsOptionNode = {
						...exportDefault.componentsOptionNode,
						properties: [
							...exportDefault.componentsOptionNode.properties,
							ts.factory.createShorthandPropertyAssignment(componentName),
						] as any as ts.NodeArray<ts.ObjectLiteralElementLike>,
					};
					const printText = printer.printNode(ts.EmitHint.Expression, newNode, sfc.scriptAst);
					const editRange = vscode.Range.create(
						textDoc.positionAt(sfc.script.startTagEnd + exportDefault.componentsOption.start),
						textDoc.positionAt(sfc.script.startTagEnd + exportDefault.componentsOption.end),
					);
					autoImportPositions.add(editRange.start);
					autoImportPositions.add(editRange.end);
					item.additionalTextEdits.push(vscode.TextEdit.replace(
						editRange,
						unescape(printText.replace(/\\u/g, '%u')),
					));
				}
				else if (exportDefault.args && exportDefault.argsNode) {
					const newNode: typeof exportDefault.argsNode = {
						...exportDefault.argsNode,
						properties: [
							...exportDefault.argsNode.properties,
							ts.factory.createShorthandPropertyAssignment(`components: { ${componentName} }`),
						] as any as ts.NodeArray<ts.ObjectLiteralElementLike>,
					};
					const printText = printer.printNode(ts.EmitHint.Expression, newNode, sfc.scriptAst);
					const editRange = vscode.Range.create(
						textDoc.positionAt(sfc.script.startTagEnd + exportDefault.args.start),
						textDoc.positionAt(sfc.script.startTagEnd + exportDefault.args.end),
					);
					autoImportPositions.add(editRange.start);
					autoImportPositions.add(editRange.end);
					item.additionalTextEdits.push(vscode.TextEdit.replace(
						editRange,
						unescape(printText.replace(/\\u/g, '%u')),
					));
				}
			}
		}
		return item;

		async function getTypeScriptInsert() {
			const embeddedScriptUri = shared.getUriByPath(context.env.rootUri, vueSourceFile.tsFileName);
			const tsImportName = camelize(path.basename(importFile).replace(/\./g, '-'));
			const confitHost = context.env.configurationHost;
			const [formatOptions, preferences] = await Promise.all([
				getFormatCodeSettings((section, scopeUri) => confitHost?.getConfiguration(section, scopeUri) as any, embeddedScriptUri),
				getUserPreferences((section, scopeUri) => confitHost?.getConfiguration(section, scopeUri) as any, embeddedScriptUri, undefined),
			]);
			(preferences as any).importModuleSpecifierEnding = 'minimal';
			const tsDetail = context.typescript.languageService.getCompletionEntryDetails(shared.getPathOfUri(embeddedScriptUri), 0, tsImportName, formatOptions, importFile, preferences, undefined);
			if (tsDetail?.codeActions) {
				for (const action of tsDetail.codeActions) {
					for (const change of action.changes) {
						for (const textChange of change.textChanges) {
							if (textChange.newText.indexOf(`import ${tsImportName} `) >= 0) {
								return {
									insertText: textChange.newText.replace(`import ${tsImportName} `, `import ${componentName} `).trim(),
									description: action.description,
								};
							}
						}
					}
				}
			}
		}
		function getMonkeyInsert() {
			const anyImport = scriptSetupImport ?? scriptImport;
			let withSemicolon = true;
			let quote = '"';
			if (anyImport) {
				withSemicolon = anyImport.text.endsWith(';');
				quote = anyImport.text.includes("'") ? "'" : '"';
			}
			return {
				insertText: `import ${componentName} from ${quote}${importPath}${quote}${withSemicolon ? ';' : ''}`,
				description: '',
			};
		}
	}

	async function provideHtmlData(vueDocument: SourceFileDocument) {

		if (!(vueDocument.file instanceof vue.VueSourceFile))
			return;

		const vueSourceFile = vueDocument.file;
		const detected = casing.detect(options.context, vueDocument.uri);
		const [attr, tag] = await Promise.all([
			context.env.configurationHost?.getConfiguration<'auto-kebab' | 'auto-camel' | 'kebab' | 'camel'>('volar.completion.preferredAttrNameCase', vueDocument.uri),
			context.env.configurationHost?.getConfiguration<'auto-kebab' | 'auto-pascal' | 'kebab' | 'pascal'>('volar.completion.preferredTagNameCase', vueDocument.uri),
		]);
		const tagNameCasing = detected.tag.length === 1 && (tag === 'auto-pascal' || tag === 'auto-kebab') ? detected.tag[0] : (tag === 'auto-kebab' || tag === 'kebab') ? TagNameCasing.Kebab : TagNameCasing.Pascal;
		const attrNameCasing = detected.attr.length === 1 && (attr === 'auto-camel' || attr === 'auto-kebab') ? detected.attr[0] : (attr === 'auto-camel' || attr === 'camel') ? AttrNameCasing.Camel : AttrNameCasing.Kebab;

		const enabledComponentAutoImport = await context.env.configurationHost?.getConfiguration<boolean>('volar.completion.autoImportComponent') ?? true;

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

					const descriptor = vueSourceFile.sfc;

					if (enabledComponentAutoImport && (descriptor.script || descriptor.scriptSetup)) {
						for (const vueDocument of options.context.documents.getAll()) {
							let baseName = path.basename(vueDocument.uri);
							if (baseName.lastIndexOf('.') !== -1) {
								baseName = baseName.substring(0, baseName.lastIndexOf('.'));
							}
							if (baseName.toLowerCase() === 'index') {
								baseName = path.basename(path.dirname(vueDocument.uri));
							}
							baseName = baseName.replace(/\./g, '-');
							const componentName_1 = hyphenate(baseName);
							const componentName_2 = capitalize(camelize(baseName));
							if (names.has(componentName_1) || names.has(componentName_2)) {
								continue;
							}
							tags.push({
								name: (tagNameCasing === TagNameCasing.Kebab ? componentName_1 : componentName_2),
								description: createInternalItemId('importFile', [vueDocument.uri]),
								attributes: [],
							});
						}
					}

					return tags;
				},
				provideAttributes: (tag) => {

					const globalProps = checkGlobalAttrs(context.typescript.module, context.typescript.languageService, vueSourceFile.fileName);
					const props = new Set(checkPropsOfTag(context.typescript.module, context.typescript.languageService, vueSourceFile, tag));
					const events = checkEventsOfTag(context.typescript.module, context.typescript.languageService, vueSourceFile, tag);
					const attributes: html.IAttributeData[] = [];

					for (const prop of [...props, ...globalProps]) {

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
						else {

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

					for (const prop of [...props, ...globalProps]) {
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

	function afterHtmlCompletion(completionList: vscode.CompletionList, vueDocument: SourceFileDocument) {

		const replacement = getReplacement(completionList, vueDocument.getDocument());
		const componentNames = new Set(checkComponentNames(context.typescript.module, context.typescript.languageService, vueDocument.file).map(hyphenate));

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

			if (itemId?.type === 'importFile') {

				const [fileUri] = itemId.args;
				const filePath = shared.getPathOfUri(fileUri);
				const rPath = path.relative(options.vueLsHost.getCurrentDirectory(), filePath);
				item.labelDetails = { description: rPath };
				item.filterText = item.label + ' ' + rPath;
				item.detail = rPath;
				item.kind = vscode.CompletionItemKind.File;
				item.sortText = '\u0003' + (item.sortText ?? item.label);
				item.data = {
					mode: 'autoImport',
					vueDocumentUri: vueDocument.uri,
					importUri: fileUri,
				} satisfies AutoImportCompletionData;
			}
			else if (itemIdKey && itemId) {

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

		{
			const temp = new Map<string, vscode.CompletionItem>();

			for (const item of completionList.items) {

				const data: AutoImportCompletionData | undefined = item.data;

				if (data?.mode === 'autoImport' && data.importUri === vueDocument.uri) { // don't import itself
					continue;
				}

				if (!temp.get(item.label)?.documentation) { // filter HTMLAttributes
					temp.set(item.label, item);
				}
			}

			completionList.items = [...temp.values()];
		}

		options.templateLanguagePlugin.updateCustomData([]);
	}

	function getLastImportNode(ast: ts.SourceFile) {
		let importNode: ts.ImportDeclaration | undefined;
		ast.forEachChild(node => {
			if (context.typescript.module.isImportDeclaration(node)) {
				importNode = node;
			}
		});
		return importNode ? {
			text: importNode.getFullText(ast).trim(),
			end: importNode.getEnd(),
		} : undefined;
	}
}

function createInternalItemId(type: 'importFile' | 'vueDirective' | 'componentEvent' | 'componentProp', args: string[]) {
	return '__VLS_::' + type + '::' + args.join(',');
}

function readInternalItemId(key: string) {
	if (key.startsWith('__VLS_::')) {
		const strs = key.split('::');
		return {
			type: strs[1] as 'importFile' | 'vueDirective' | 'componentEvent' | 'componentProp',
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
