import useHtmlPlugin from '@volar-plugins/html';
import { EmbeddedLanguageServicePlugin, LanguageServiceRuntimeContext, PluginContext, SourceFileDocument } from '@volar/language-service';
import * as shared from '@volar/shared';
import * as ts2 from '@volar/typescript-language-service';
import * as embedded from '@volar/language-core';
import * as vue from '@volar/vue-language-core';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'upath';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { checkTemplateData, getTemplateTagsAndAttrs } from '../helpers';
import * as casing from '../ideFeatures/nameCasing';

export const semanticTokenTypes = [
	'componentTag',
];

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

interface HtmlCompletionData {
	mode: 'html',
	tsItem: ts.CompletionEntry | undefined,
}

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
}): EmbeddedLanguageServicePlugin & T {

	const componentCompletionDataCache = new WeakMap<
		Awaited<ReturnType<typeof checkTemplateData>>,
		Map<string, { item: ts.CompletionEntry | undefined, bind: ts.CompletionEntry[], on: ts.CompletionEntry[]; }>
	>();
	const autoImportPositions = new WeakSet<vscode.Position>();
	const tokenTypes = new Map(options.getSemanticTokenLegend().tokenTypes.map((t, i) => [t, i]));
	const runtimeMode = vue.resolveVueCompilerOptions(options.vueLsHost.getVueCompilationSettings()).experimentalRuntimeMode;

	let context: PluginContext;

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
				let tsItems: Awaited<ReturnType<typeof provideHtmlData>> | undefined;

				if (vueDocument) {
					tsItems = await provideHtmlData(vueDocument);
				}

				const htmlComplete = await options.templateLanguagePlugin.complete?.on?.(document, position, context);

				if (!htmlComplete)
					return;

				if (vueDocument && tsItems) {
					afterHtmlCompletion(htmlComplete, vueDocument, tsItems);
				}

				return htmlComplete;
			},

			async resolve(item) {

				const data: HtmlCompletionData | AutoImportCompletionData | undefined = item.data;

				if (data?.mode === 'html') {
					return await resolveHtmlItem(item, data);
				}
				else if (data?.mode === 'autoImport') {
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
			async onFull(document) {

				if (!options.isSupportedDocument(document))
					return;

				const originalResult = await options.templateLanguagePlugin.validation?.onFull?.(document);
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

				const templateScriptData = checkTemplateData(vueDocument.file, context.typescript.languageService);
				const components = new Set([
					...templateScriptData.components,
					...templateScriptData.components.map(hyphenate).filter(name => !vue.isIntrinsicElement(runtimeMode, name)),
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

	async function resolveHtmlItem(item: vscode.CompletionItem, data: HtmlCompletionData) {

		// let tsItem = data.tsItem;

		// if (!tsItem)
		// 	return item;

		// tsItem = await options.getTsLs().doCompletionResolve(tsItem);
		// item.tags = [...item.tags ?? [], ...tsItem.tags ?? []];

		// const details: string[] = [];
		// const documentations: string[] = [];

		// if (item.detail) details.push(item.detail);
		// if (tsItem.detail) details.push(tsItem.detail);
		// if (details.length) {
		// 	item.detail = details.join('\n\n');
		// }

		// if (item.documentation) documentations.push(typeof item.documentation === 'string' ? item.documentation : item.documentation.value);
		// if (tsItem.documentation) documentations.push(typeof tsItem.documentation === 'string' ? tsItem.documentation : tsItem.documentation.value);
		// if (documentations.length) {
		// 	item.documentation = {
		// 		kind: vscode.MarkupKind.Markdown,
		// 		value: documentations.join('\n\n'),
		// 	};
		// }

		return item;
	}

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
				ts2.getFormatCodeSettings((section, scopeUri) => confitHost?.getConfiguration(section, scopeUri) as any, embeddedScriptUri),
				ts2.getUserPreferences((section, scopeUri) => confitHost?.getConfiguration(section, scopeUri) as any, embeddedScriptUri),
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
			context.env.configurationHost?.getConfiguration<'auto' | 'both' | 'kebab' | 'pascal'>('volar.completion.preferredTagNameCase', vueDocument.uri),
		]);
		const nameCases = {
			tag: tag === 'auto' && detected.tag !== 'unsure' ? detected.tag : (tag === 'kebab' ? 'kebabCase' : tag === 'pascal' ? 'pascalCase' : 'both'),
			attr: detected.attr !== 'unsure' && (attr === 'auto-camel' || attr === 'auto-kebab') ? detected.attr : (attr === 'auto-camel' || attr === 'camel') ? 'camelCase' : 'kebabCase',
		};
		const componentCompletion = await getComponentCompletionData(vueDocument);
		if (!componentCompletion)
			return;

		const tags: html.ITagData[] = [];
		const tsItems = new Map<string, ts.CompletionEntry>();
		const globalAttributes: html.IAttributeData[] = [];

		for (const [_componentName, { item, bind, on }] of componentCompletion) {

			const componentNames =
				nameCases.tag === 'kebabCase' ? new Set([hyphenate(_componentName)])
					: nameCases.tag === 'pascalCase' ? new Set([_componentName])
						: new Set([hyphenate(_componentName), _componentName]);

			for (const componentName of componentNames) {

				const attributes: html.IAttributeData[] = componentName === '*' ? globalAttributes : [];

				for (const prop of bind) {

					const name = nameCases.attr === 'camelCase' ? prop.name : hyphenate(prop.name);

					if (hyphenate(name).startsWith('on-')) {

						const propNameBase = name.startsWith('on-')
							? name.slice('on-'.length)
							: (name['on'.length].toLowerCase() + name.slice('onX'.length));
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

					const name = nameCases.attr === 'camelCase' ? event.name : hyphenate(event.name);
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

				const componentKey = createInternalItemId('component', [componentName]);

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

		const descriptor = vueSourceFile.sfc;
		const enabledComponentAutoImport = await context.env.configurationHost?.getConfiguration<boolean>('volar.completion.autoImportComponent') ?? true;

		if (enabledComponentAutoImport && (descriptor.script || descriptor.scriptSetup)) {
			for (const vueDocument of options.context.documents.getAll()) {
				let baseName = path.removeExt(path.basename(vueDocument.uri), '.vue');
				if (baseName.toLowerCase() === 'index') {
					baseName = path.basename(path.dirname(vueDocument.uri));
				}
				baseName = baseName.replace(/\./g, '-');
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
					description: createInternalItemId('importFile', [vueDocument.uri]),
					attributes: [],
				});
			}
		}

		const dataProvider = html.newHTMLDataProvider('vue-html', {
			version: 1.1,
			tags,
			globalAttributes,
		});

		options.templateLanguagePlugin.updateCustomData([
			vueGlobalDirectiveProvider,
			dataProvider,
		]);

		return tsItems;
	}

	function afterHtmlCompletion(completionList: vscode.CompletionList, vueDocument: SourceFileDocument, tsItems: Map<string, ts.CompletionEntry>) {

		const replacement = getReplacement(completionList, vueDocument.getDocument());

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
				const data: AutoImportCompletionData = {
					mode: 'autoImport',
					vueDocumentUri: vueDocument.uri,
					importUri: fileUri,
				};
				item.labelDetails = { description: rPath };
				item.filterText = item.label + ' ' + rPath;
				item.detail = rPath;
				item.kind = vscode.CompletionItemKind.File;
				item.sortText = '\u0003' + (item.sortText ?? item.label);
				item.data = data;
			}
			else if (itemIdKey && itemId) {

				const tsItem = itemIdKey ? tsItems.get(itemIdKey) : undefined;

				if (itemId.type === 'componentProp' || itemId.type === 'componentEvent') {

					const [componentName] = itemId.args;

					if (componentName !== '*') {
						item.sortText = '\u0000' + (item.sortText ?? item.label);
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
					item.sortText = '\u0003' + (item.sortText ?? item.label);
				}
				else if (item.label.startsWith('v-')) {
					item.kind = vscode.CompletionItemKind.Function;
					item.sortText = '\u0002' + (item.sortText ?? item.label);
				}
				else {
					item.sortText = '\u0001' + (item.sortText ?? item.label);
				}

				const data: HtmlCompletionData = {
					mode: 'html',
					tsItem: tsItem,
				};

				item.data = data;
			}
		}

		{
			const temp = new Map<string, vscode.CompletionItem>();

			for (const item of completionList.items) {

				const data: HtmlCompletionData | AutoImportCompletionData | undefined = item.data;

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

	async function getComponentCompletionData(sourceDocument: SourceFileDocument) {

		if (!(sourceDocument.file instanceof vue.VueSourceFile))
			return;

		const vueSourceFile = sourceDocument.file;
		const templateData = checkTemplateData(vueSourceFile, context.typescript.languageService);

		let cache = componentCompletionDataCache.get(templateData);
		if (!cache) {

			cache = new Map();

			let file: embedded.SourceFile | undefined;
			embedded.forEachEmbeddeds(sourceDocument.file.embeddeds, embedded => {
				if (embedded.fileName === vueSourceFile.tsFileName) {
					file = embedded;
				}
			});

			const templateTagNames = [...getTemplateTagsAndAttrs(sourceDocument.file).tags.keys()];
			const completionOptions: ts.GetCompletionsAtPositionOptions = {
				includeCompletionsWithInsertText: true, // if missing, { 'aaa-bbb': any, ccc: any } type only has result ['ccc']
			};

			if (file) {

				const tags_1 = templateData.componentItems.map(item => {
					return { item, name: item.name };
				});
				const tags_2 = templateTagNames
					.filter(tag => tag.indexOf('.') >= 0)
					.map(tag => ({ name: tag, item: undefined }));

				for (const tag of [...tags_1, ...tags_2]) {

					if (cache.has(tag.name))
						continue;

					let bind: ts.CompletionEntry[] = [];
					let on: ts.CompletionEntry[] = [];
					{
						const searchText = vue.SearchTexts.PropsCompletion(tag.name);
						let offset = file.text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							try {
								bind = (await context.typescript.languageService.getCompletionsAtPosition(file.fileName, offset, completionOptions))?.entries
									.filter(entry => entry.kind !== 'warning') ?? [];
							} catch { }
						}
					}
					{
						const searchText = vue.SearchTexts.EmitCompletion(tag.name);
						let offset = file.text.indexOf(searchText);
						if (offset >= 0) {
							offset += searchText.length;
							try {
								on = (await context.typescript.languageService.getCompletionsAtPosition(file.fileName, offset, completionOptions))?.entries
									.filter(entry => entry.kind !== 'warning') ?? [];
							} catch { }
						}
					}
					cache.set(tag.name, { item: tag.item, bind, on });
				}
				try {
					const offset = file.text.indexOf(vue.SearchTexts.GlobalAttrs);
					const globalBind = (await context.typescript.languageService.getCompletionsAtPosition(file.fileName, offset, completionOptions))?.entries
						.filter(entry => entry.kind !== 'warning') ?? [];
					cache.set('*', { item: undefined, bind: globalBind, on: [] });
				} catch { }
			}

			componentCompletionDataCache.set(templateData, cache);
		}

		return cache;
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
