import type {
	CompletionItem,
	CompletionItemKind,
	Diagnostic,
	DiagnosticSeverity,
	DocumentSymbol,
	LanguageServicePlugin,
	SymbolKind,
} from '@volar/language-service';
import type { IRBlock } from '@vue/language-core';
import { create as createHtmlService } from 'volar-service-html';
import * as html from 'vscode-html-languageservice';
import { loadLanguageBlocks } from '../htmlData';
import { embeddedCodeIds, rootTagsLanguageId, VueVirtualCode } from '../virtualCode';
import { resolveEmbeddedCode } from '../virtualCodeQueries';

let sfcDataProvider: html.IHTMLDataProvider | undefined;

export function create(): LanguageServicePlugin {
	const htmlService = createHtmlService({
		documentSelector: [rootTagsLanguageId],
		useDefaultDataProvider: false,
		getCustomData(context) {
			sfcDataProvider ??= html.newHTMLDataProvider('vue', loadLanguageBlocks(context.env.locale ?? 'en'));
			return [sfcDataProvider];
		},
		async getFormattingOptions(document, options, context) {
			const info = resolveEmbeddedCode(context, document.uri);
			if (info?.code.id !== embeddedCodeIds.rootTags) {
				return {};
			}

			const formatSettings = await context.env.getConfiguration<html.HTMLFormatConfiguration>?.('html.format') ?? {};
			const blockTypes = ['template', 'script', 'style'];

			for (const customBlock of info.root.ir.customBlocks) {
				blockTypes.push(customBlock.type);
			}

			return {
				...options,
				...formatSettings,
				wrapAttributes: await context.env.getConfiguration<string>?.('vue.format.wrapAttributes') ?? 'auto',
				unformatted: '',
				contentUnformatted: blockTypes.join(','),
				endWithNewline: options.insertFinalNewline
					? true
					: options.trimFinalNewlines
					? false
					: document.getText().endsWith('\n'),
			};
		},
	});
	return {
		...htmlService,
		name: 'vue-sfc',
		capabilities: {
			...htmlService.capabilities,
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false,
			},
		},
		create(context) {
			const htmlServiceInstance = htmlService.create(context);

			return {
				...htmlServiceInstance,

				provideDocumentLinks: undefined,
				async resolveEmbeddedCodeFormattingOptions(sourceScript, virtualCode, options) {
					if (sourceScript.generated?.root instanceof VueVirtualCode) {
						if (virtualCode.id === embeddedCodeIds.scriptRaw || virtualCode.id === embeddedCodeIds.scriptSetupRaw) {
							if (await context.env.getConfiguration<boolean>?.('vue.format.script.initialIndent') ?? false) {
								options.initialIndentLevel++;
							}
						}
						else if (virtualCode.id.startsWith(embeddedCodeIds.stylePrefix)) {
							if (await context.env.getConfiguration<boolean>?.('vue.format.style.initialIndent') ?? false) {
								options.initialIndentLevel++;
							}
						}
						else if (virtualCode.id === embeddedCodeIds.template) {
							if (await context.env.getConfiguration<boolean>?.('vue.format.template.initialIndent') ?? true) {
								options.initialIndentLevel++;
							}
						}
					}
					return options;
				},

				async provideDiagnostics(document, token) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== embeddedCodeIds.rootTags) {
						return [];
					}

					const { ir } = info.root;
					const originalResult = await htmlServiceInstance.provideDiagnostics?.(document, token);
					const formatErrors = ir.errors.map((error): Diagnostic => ({
						range: {
							start: document.positionAt(error.loc?.start.offset ?? 0),
							end: document.positionAt(error.loc?.end.offset ?? 0),
						},
						severity: 1 satisfies typeof DiagnosticSeverity.Error,
						code: error.code,
						source: 'vue',
						message: error.message,
					}));

					return [
						...originalResult ?? [],
						...formatErrors,
					];
				},

				provideDocumentSymbols(document) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== embeddedCodeIds.rootTags) {
						return;
					}

					const result: DocumentSymbol[] = [];
					const { ir } = info.root;

					const blocks: [block: IRBlock | undefined, name: string][] = [
						[ir.template, 'template'],
						[ir.script, 'script'],
						[ir.scriptSetup, 'script setup'],
						...ir.styles.map((style): [IRBlock, string] => [
							style,
							'style' + (style.scoped ? ' scoped' : '') + (style.module ? ' module' : ''),
						]),
						...ir.customBlocks.map((block): [IRBlock, string] => [block, block.type]),
					];
					for (const [block, name] of blocks) {
						// a block that is not written as an element has no symbol
						if (!block?.element) {
							continue;
						}
						result.push({
							name,
							kind: 2 satisfies typeof SymbolKind.Module,
							range: {
								start: document.positionAt(block.element.start),
								end: document.positionAt(block.element.end),
							},
							selectionRange: {
								start: document.positionAt(block.element.start),
								end: document.positionAt(block.offset),
							},
						});
					}

					return result;
				},

				async provideCompletionItems(document, position, context, token) {
					const result = await htmlServiceInstance.provideCompletionItems?.(document, position, context, token);
					if (!result) {
						return;
					}
					result.items = result.items.filter(item =>
						item.label !== '!DOCTYPE'
						&& item.label !== 'Custom Blocks'
						&& item.label !== 'data-'
					);

					const tags = sfcDataProvider?.provideTags();

					const scriptLangs = getLangs('script');
					const scriptItems = result.items.filter(item => item.label === 'script' || item.label === 'script setup');
					for (const scriptItem of scriptItems) {
						scriptItem.kind = 17 satisfies typeof CompletionItemKind.File;
						scriptItem.detail = '.js';
						for (const lang of scriptLangs) {
							result.items.push({
								...scriptItem,
								detail: `.${lang}`,
								kind: 17 satisfies typeof CompletionItemKind.File,
								label: scriptItem.label + ' lang="' + lang + '"',
								textEdit: scriptItem.textEdit
									? {
										...scriptItem.textEdit,
										newText: scriptItem.textEdit.newText + ' lang="' + lang + '"',
									}
									: undefined,
							});
						}
					}

					const styleLangs = getLangs('style');
					const styleItem = result.items.find(item => item.label === 'style');
					if (styleItem) {
						styleItem.kind = 17 satisfies typeof CompletionItemKind.File;
						styleItem.detail = '.css';
						for (const lang of styleLangs) {
							result.items.push(
								getStyleCompletionItem(styleItem, lang),
								getStyleCompletionItem(styleItem, lang, 'scoped'),
								getStyleCompletionItem(styleItem, lang, 'module'),
							);
						}
					}

					const templateLangs = getLangs('template');
					const templateItem = result.items.find(item => item.label === 'template');
					if (templateItem) {
						templateItem.kind = 17 satisfies typeof CompletionItemKind.File;
						templateItem.detail = '.html';
						for (const lang of templateLangs) {
							if (lang === 'html') {
								continue;
							}
							result.items.push({
								...templateItem,
								kind: 17 satisfies typeof CompletionItemKind.File,
								detail: `.${lang}`,
								label: templateItem.label + ' lang="' + lang + '"',
								textEdit: templateItem.textEdit
									? {
										...templateItem.textEdit,
										newText: templateItem.textEdit.newText + ' lang="' + lang + '"',
									}
									: undefined,
							});
						}
					}
					return result;

					function getLangs(label: string) {
						return tags
							?.find(tag => tag.name === label)?.attributes
							.find(attr => attr.name === 'lang')?.values
							?.map(({ name }) => name) ?? [];
					}
				},
			};
		},
	};
}

function getStyleCompletionItem(
	styleItem: CompletionItem,
	lang: string,
	attr?: string,
): CompletionItem {
	return {
		...styleItem,
		kind: 17 satisfies typeof CompletionItemKind.File,
		detail: lang === 'postcss' ? '.css' : `.${lang}`,
		label: styleItem.label + ' lang="' + lang + '"' + (attr ? ` ${attr}` : ''),
		textEdit: styleItem.textEdit
			? {
				...styleItem.textEdit,
				newText: styleItem.textEdit.newText + ' lang="' + lang + '"' + (attr ? ` ${attr}` : ''),
			}
			: undefined,
	};
}
