import type { LanguageServicePlugin, LanguageServicePluginInstance } from '@volar/language-service';
import * as vue from '@vue/language-core';
import { create as createHtmlService } from 'volar-service-html';
import * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { loadLanguageBlocks } from './data';

let sfcDataProvider: html.IHTMLDataProvider | undefined;

export interface Provide {
	'vue/vueFile': (document: TextDocument) => vue.VueVirtualCode | undefined;
}

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-sfc',
		create(context): LanguageServicePluginInstance<Provide> {
			const htmlPlugin = createHtmlService({
				documentSelector: ['vue'],
				useDefaultDataProvider: false,
				getCustomData(context) {
					sfcDataProvider ??= html.newHTMLDataProvider('vue', loadLanguageBlocks(context.env.locale ?? 'en'));
					return [sfcDataProvider];
				},
				async getFormattingOptions(document, options, context) {
					return await worker(document, async vueCode => {

						const formatSettings = await context.env.getConfiguration?.<html.HTMLFormatConfiguration>('html.format') ?? {};
						const blockTypes = ['template', 'script', 'style'];

						for (const customBlock of vueCode.sfc.customBlocks) {
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
			}).create(context);

			return {

				...htmlPlugin,

				provide: {
					'vue/vueFile': document => {
						return worker(document, vueFile => {
							return vueFile;
						});
					},
				},

				async resolveEmbeddedCodeFormattingOptions(sourceScript, virtualCode, options) {
					if (sourceScript.generated?.root instanceof vue.VueVirtualCode) {
						if (virtualCode.id === 'scriptFormat' || virtualCode.id === 'scriptSetupFormat') {
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

				provideDocumentLinks: undefined,

				provideDocumentSymbols(document) {
					return worker(document, vueSourceFile => {

						const result: vscode.DocumentSymbol[] = [];
						const descriptor = vueSourceFile.sfc;

						if (descriptor.template) {
							result.push({
								name: 'template',
								kind: 2 satisfies typeof vscode.SymbolKind.Module,
								range: {
									start: document.positionAt(descriptor.template.start),
									end: document.positionAt(descriptor.template.end),
								},
								selectionRange: {
									start: document.positionAt(descriptor.template.start),
									end: document.positionAt(descriptor.template.startTagEnd),
								},
							});
						}
						if (descriptor.script) {
							result.push({
								name: 'script',
								kind: 2 satisfies typeof vscode.SymbolKind.Module,
								range: {
									start: document.positionAt(descriptor.script.start),
									end: document.positionAt(descriptor.script.end),
								},
								selectionRange: {
									start: document.positionAt(descriptor.script.start),
									end: document.positionAt(descriptor.script.startTagEnd),
								},
							});
						}
						if (descriptor.scriptSetup) {
							result.push({
								name: 'script setup',
								kind: 2 satisfies typeof vscode.SymbolKind.Module,
								range: {
									start: document.positionAt(descriptor.scriptSetup.start),
									end: document.positionAt(descriptor.scriptSetup.end),
								},
								selectionRange: {
									start: document.positionAt(descriptor.scriptSetup.start),
									end: document.positionAt(descriptor.scriptSetup.startTagEnd),
								},
							});
						}
						for (const style of descriptor.styles) {
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
						for (const customBlock of descriptor.customBlocks) {
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
			};

			function worker<T>(document: TextDocument, callback: (vueSourceFile: vue.VueVirtualCode) => T) {
				const decoded = context.decodeEmbeddedDocumentUri(document.uri);
				const sourceScript = decoded && context.language.scripts.get(decoded[0]);
				const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
				if (virtualCode instanceof vue.VueVirtualCode) {
					return callback(virtualCode);
				}
			}
		},
	};
}
