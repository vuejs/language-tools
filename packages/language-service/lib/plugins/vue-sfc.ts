import type { ServicePlugin, ServicePluginInstance } from '@volar/language-service';
import * as vue from '@vue/language-core';
import { create as createHtmlService } from 'volar-service-html';
import * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { loadLanguageBlocks } from './data';

let sfcDataProvider: html.IHTMLDataProvider | undefined;

export interface Provide {
	'vue/vueFile': (document: TextDocument) => vue.VueGeneratedCode | undefined;
}

export function create(): ServicePlugin {
	return {
		name: 'vue-sfc',
		create(context): ServicePluginInstance<Provide> {

			const htmlPlugin = createHtmlService({
				documentSelector: ['vue'],
				useCustomDataProviders: false,
			}).create(context);
			const htmlLanguageService: html.LanguageService = htmlPlugin.provide['html/languageService']();

			sfcDataProvider ??= html.newHTMLDataProvider('vue', loadLanguageBlocks(context.env.locale ?? 'en'));

			htmlLanguageService.setDataProviders(false, [sfcDataProvider]);

			return {

				...htmlPlugin,

				provide: {
					'vue/vueFile': document => {
						return worker(document, (vueFile) => {
							return vueFile;
						});
					},
				},

				async resolveEmbeddedCodeFormattingOptions(code, options) {

					const sourceFile = context.language.files.getByVirtualCode(code);

					if (sourceFile.generated?.code instanceof vue.VueGeneratedCode) {
						if (code.id === 'scriptFormat' || code.id === 'scriptSetupFormat') {
							if (await context.env.getConfiguration?.('vue.format.script.initialIndent') ?? false) {
								options.initialIndentLevel++;
							}
						}
						else if (code.id.startsWith('style_')) {
							if (await context.env.getConfiguration?.('vue.format.style.initialIndent') ?? false) {
								options.initialIndentLevel++;
							}
						}
						else if (code.id === 'template') {
							if (await context.env.getConfiguration?.('vue.format.template.initialIndent') ?? true) {
								options.initialIndentLevel++;
							}
						}
					}

					return options;
				},

				provideDocumentLinks: undefined,

				provideDocumentSymbols(document) {
					return worker(document, (vueSourceFile) => {

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
							if (style.scoped)
								name += ' scoped';
							if (style.module)
								name += ' module';
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

				provideDocumentFormattingEdits(document, range, options) {
					return worker(document, async vueCode => {

						const formatSettings = await context.env.getConfiguration?.<html.HTMLFormatConfiguration>('html.format') ?? {};
						const blockTypes = ['template', 'script', 'style'];

						for (const customBlock of vueCode.sfc.customBlocks) {
							blockTypes.push(customBlock.type);
						}

						return htmlLanguageService.format(document, range, {
							...options,
							...formatSettings,
							unformatted: '',
							contentUnformatted: blockTypes.join(','),
							extraLiners: blockTypes.join(','),
							endWithNewline: options.insertFinalNewline ? true
								: options.trimFinalNewlines ? false
									: document.getText().endsWith('\n'),
						});
					});
				},
			};

			function worker<T>(document: TextDocument, callback: (vueSourceFile: vue.VueGeneratedCode) => T) {
				const [vueFile] = context.documents.getVirtualCodeByUri(document.uri);
				if (vueFile instanceof vue.VueGeneratedCode) {
					return callback(vueFile);
				}
			}
		},
	};
}
