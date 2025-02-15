import type { LanguageServiceContext, LanguageServicePlugin } from '@volar/language-service';
import { VueVirtualCode } from '@vue/language-core';
import { create as createHtmlService } from 'volar-service-html';
import * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { loadLanguageBlocks } from './data';

let sfcDataProvider: html.IHTMLDataProvider | undefined;

export function create(): LanguageServicePlugin {
	const htmlService = createHtmlService({
		documentSelector: ['vue-root-tags'],
		useDefaultDataProvider: false,
		getCustomData(context) {
			sfcDataProvider ??= html.newHTMLDataProvider('vue', loadLanguageBlocks(context.env.locale ?? 'en'));
			return [sfcDataProvider];
		},
		async getFormattingOptions(document, options, context) {
			return await worker(document, context, async root => {

				const formatSettings = await context.env.getConfiguration?.<html.HTMLFormatConfiguration>('html.format') ?? {};
				const blockTypes = ['template', 'script', 'style'];

				for (const customBlock of root.sfc.customBlocks) {
					blockTypes.push(customBlock.type);
				}

				return {
					...options,
					...formatSettings,
					wrapAttributes: await context.env.getConfiguration?.<string>('vue.format.wrapAttributes') ?? 'auto',
					unformatted: '',
					contentUnformatted: blockTypes.join(','),
					endWithNewline: options.insertFinalNewline ? true
						: options.trimFinalNewlines ? false
							: document.getText().endsWith('\n'),
				};
			}) ?? {};
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
			}
		},
		create(context) {
			const htmlServiceInstance = htmlService.create(context);

			return {

				...htmlServiceInstance,

				provideDocumentLinks: undefined,

				async resolveEmbeddedCodeFormattingOptions(sourceScript, virtualCode, options) {
					if (sourceScript.generated?.root instanceof VueVirtualCode) {
						if (virtualCode.id === 'script_raw' || virtualCode.id === 'scriptsetup_raw') {
							if (await context.env.getConfiguration?.('vue.format.script.initialIndent') ?? false) {
								options.initialIndentLevel++;
							}
						}
						else if (virtualCode.id.startsWith('style_')) {
							if (await context.env.getConfiguration?.('vue.format.style.initialIndent') ?? false) {
								options.initialIndentLevel++;
							}
						}
						else if (virtualCode.id === 'template') {
							if (await context.env.getConfiguration?.('vue.format.template.initialIndent') ?? true) {
								options.initialIndentLevel++;
							}
						}
					}
					return options;
				},

				provideDiagnostics(document, token) {
					return worker(document, context, async root => {
						const { vueSfc, sfc } = root;
						if (!vueSfc) {
							return;
						}

						const originalResult = await htmlServiceInstance.provideDiagnostics?.(document, token);
						const sfcErrors: vscode.Diagnostic[] = [];
						const { template } = sfc;

						const {
							startTagEnd = Infinity,
							endTagStart = -Infinity
						} = template ?? {};

						for (const error of vueSfc.errors) {
							if ('code' in error) {
								const start = error.loc?.start.offset ?? 0;
								const end = error.loc?.end.offset ?? 0;
								if (end < startTagEnd || start >= endTagStart) {
									sfcErrors.push({
										range: {
											start: document.positionAt(start),
											end: document.positionAt(end),
										},
										severity: 1 satisfies typeof vscode.DiagnosticSeverity.Error,
										code: error.code,
										source: 'vue',
										message: error.message,
									});
								}
							}
						}

						return [
							...originalResult ?? [],
							...sfcErrors
						];
					});
				},

				provideDocumentSymbols(document) {
					return worker(document, context, root => {

						const result: vscode.DocumentSymbol[] = [];
						const { sfc } = root;

						if (sfc.template) {
							result.push({
								name: 'template',
								kind: 2 satisfies typeof vscode.SymbolKind.Module,
								range: {
									start: document.positionAt(sfc.template.start),
									end: document.positionAt(sfc.template.end),
								},
								selectionRange: {
									start: document.positionAt(sfc.template.start),
									end: document.positionAt(sfc.template.startTagEnd),
								},
							});
						}
						if (sfc.script) {
							result.push({
								name: 'script',
								kind: 2 satisfies typeof vscode.SymbolKind.Module,
								range: {
									start: document.positionAt(sfc.script.start),
									end: document.positionAt(sfc.script.end),
								},
								selectionRange: {
									start: document.positionAt(sfc.script.start),
									end: document.positionAt(sfc.script.startTagEnd),
								},
							});
						}
						if (sfc.scriptSetup) {
							result.push({
								name: 'script setup',
								kind: 2 satisfies typeof vscode.SymbolKind.Module,
								range: {
									start: document.positionAt(sfc.scriptSetup.start),
									end: document.positionAt(sfc.scriptSetup.end),
								},
								selectionRange: {
									start: document.positionAt(sfc.scriptSetup.start),
									end: document.positionAt(sfc.scriptSetup.startTagEnd),
								},
							});
						}
						for (const style of sfc.styles) {
							let name = 'style';
							if (style.scoped) {
								name += ' scoped';
							}
							if (style.module) {
								name += ' module';
							}
							result.push({
								name,
								kind: 2 satisfies typeof vscode.SymbolKind.Module,
								range: {
									start: document.positionAt(style.start),
									end: document.positionAt(style.end),
								},
								selectionRange: {
									start: document.positionAt(style.start),
									end: document.positionAt(style.startTagEnd),
								},
							});
						}
						for (const customBlock of sfc.customBlocks) {
							result.push({
								name: `${customBlock.type}`,
								kind: 2 satisfies typeof vscode.SymbolKind.Module,
								range: {
									start: document.positionAt(customBlock.start),
									end: document.positionAt(customBlock.end),
								},
								selectionRange: {
									start: document.positionAt(customBlock.start),
									end: document.positionAt(customBlock.startTagEnd),
								},
							});
						}

						return result;
					});
				},

				async provideCompletionItems(document, position, context, token) {
					const result = await htmlServiceInstance.provideCompletionItems?.(document, position, context, token);
					if (!result) {
						return;
					}
					result.items = result.items.filter(item => item.label !== '!DOCTYPE' && item.label !== 'Custom Blocks');

					const tags = sfcDataProvider?.provideTags();

					const scriptLangs = getLangs('script');
					const scriptItems = result.items.filter(item => item.label === 'script' || item.label === 'script setup');
					for (const scriptItem of scriptItems) {
						scriptItem.kind = 17 satisfies typeof vscode.CompletionItemKind.File;
						scriptItem.detail = '.js';
						for (const lang of scriptLangs) {
							result.items.push({
								...scriptItem,
								detail: `.${lang}`,
								kind: 17 satisfies typeof vscode.CompletionItemKind.File,
								label: scriptItem.label + ' lang="' + lang + '"',
								textEdit: scriptItem.textEdit ? {
									...scriptItem.textEdit,
									newText: scriptItem.textEdit.newText + ' lang="' + lang + '"',
								} : undefined,
							});
						}
					}

					const styleLangs = getLangs('style');
					const styleItem = result.items.find(item => item.label === 'style');
					if (styleItem) {
						styleItem.kind = 17 satisfies typeof vscode.CompletionItemKind.File;
						styleItem.detail = '.css';
						for (const lang of styleLangs) {
							result.items.push(
								getStyleCompletionItem(styleItem, lang),
								getStyleCompletionItem(styleItem, lang, 'scoped'),
								getStyleCompletionItem(styleItem, lang, 'module')
							);
						}
					}

					const templateLangs = getLangs('template');
					const templateItem = result.items.find(item => item.label === 'template');
					if (templateItem) {
						templateItem.kind = 17 satisfies typeof vscode.CompletionItemKind.File;
						templateItem.detail = '.html';
						for (const lang of templateLangs) {
							if (lang === 'html') {
								continue;
							}
							result.items.push({
								...templateItem,
								kind: 17 satisfies typeof vscode.CompletionItemKind.File,
								detail: `.${lang}`,
								label: templateItem.label + ' lang="' + lang + '"',
								textEdit: templateItem.textEdit ? {
									...templateItem.textEdit,
									newText: templateItem.textEdit.newText + ' lang="' + lang + '"',
								} : undefined,
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

	function worker<T>(document: TextDocument, context: LanguageServiceContext, callback: (root: VueVirtualCode) => T) {
		if (document.languageId !== 'vue-root-tags') {
			return;
		}
		const uri = URI.parse(document.uri);
		const decoded = context.decodeEmbeddedDocumentUri(uri);
		const sourceScript = decoded && context.language.scripts.get(decoded[0]);
		const root = sourceScript?.generated?.root;
		if (root instanceof VueVirtualCode) {
			return callback(root);
		}
	}
}

function getStyleCompletionItem(
	styleItem: vscode.CompletionItem,
	lang: string,
	attr?: string
): vscode.CompletionItem {
	return {
		...styleItem,
		kind: 17 satisfies typeof vscode.CompletionItemKind.File,
		detail: lang === 'postcss' ? '.css' : `.${lang}`,
		label: styleItem.label + ' lang="' + lang + '"' + (attr ? ` ${attr}` : ''),
		textEdit: styleItem.textEdit ? {
			...styleItem.textEdit,
			newText: styleItem.textEdit.newText + ' lang="' + lang + '"' + (attr ? ` ${attr}` : ''),
		} : undefined
	};
}
