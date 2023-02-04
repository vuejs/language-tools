import * as shared from '@volar/shared';
import { parseScriptSetupRanges } from '@volar/vue-language-core';
import { LanguageServicePlugin } from '@volar/language-service';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as createHtmlPlugin from '@volar-plugins/html';
import * as vue from '@volar/vue-language-core';
import { VueCompilerOptions } from '../types';

const dataProvider: html.IHTMLDataProvider = {
	getId: () => 'vue',
	isApplicable: () => true,
	provideTags: () => [
		{
			name: 'template',
			attributes: [],
		},
		{
			name: 'script',
			attributes: [],
		},
		{
			name: 'style',
			attributes: [],
		},
	],
	provideAttributes: (tag) => {
		if (tag === 'template') {
			return [
				{ name: 'src' },
				{ name: 'lang' },
			];
		}
		else if (tag === 'script') {
			return [
				{ name: 'src' },
				{ name: 'lang' },
				{ name: 'setup', valueSet: 'v' },
				{ name: 'generic' },
			];
		}
		else if (tag === 'style') {
			return [
				{ name: 'src' },
				{ name: 'lang' },
				{ name: 'scoped', valueSet: 'v' },
				{ name: 'module', valueSet: 'v' },
			];
		}
		else {
			return [
				{ name: 'src' },
				{ name: 'lang' }
			];
		}
	},
	provideValues: (tag, attribute) => {
		if (attribute === 'lang') {
			if (tag === 'template') {
				return [
					{ name: 'html' },
					{ name: 'pug' },
				];
			}
			else if (tag === 'script') {
				return [
					{ name: 'js' },
					{ name: 'ts' },
					{ name: 'jsx' },
					{ name: 'tsx' },
				];
			}
			else if (tag === 'style') {
				return [
					{ name: 'css' },
					{ name: 'scss' },
					{ name: 'less' },
					{ name: 'stylus' },
					{ name: 'postcss' },
					{ name: 'sass' },
				];
			}
			else {
				return [
					// template
					{ name: 'html' },
					{ name: 'pug' },
					// script
					{ name: 'js' },
					{ name: 'ts' },
					{ name: 'jsx' },
					{ name: 'tsx' },
					// style
					{ name: 'css' },
					{ name: 'scss' },
					{ name: 'less' },
					{ name: 'stylus' },
					{ name: 'postcss' },
					{ name: 'sass' },
					// custom block
					{ name: 'md' },
					{ name: 'json' },
					{ name: 'jsonc' },
					{ name: 'json5' },
					{ name: 'yaml' },
					{ name: 'toml' },
					{ name: 'gql' },
					{ name: 'graphql' },
				];
			}
		}
		return [];
	},
};

export default (vueCompilerOptions: VueCompilerOptions): LanguageServicePlugin => (context, service) => {

	if (!context.typescript)
		return {};

	const _ts = context.typescript;
	const htmlPlugin = createHtmlPlugin({
		validLang: 'vue',
		disableCustomData: true,
	})(context, service);
	htmlPlugin.getHtmlLs().setDataProviders(false, [dataProvider]);
	const emptyBlocksDocument = new WeakMap<TextDocument, [number, TextDocument]>();

	if (htmlPlugin.complete?.on) {
		htmlPlugin.complete.on = apiWithEmptyBlocksDocument(htmlPlugin.complete.on);
	}

	return {

		...htmlPlugin,

		rules: {
			prepare(context) {
				worker(context.document, (document, vueSourceFile) => {
					context.vue = {
						version: 'alpha',
						modules: {
							typescript: _ts.module,
						},
						compilerOptions: _ts.languageServiceHost.getCompilationSettings(),
						vueCompilerOptions,
						sfc: vueSourceFile.sfc,
						blocksClearedDocument: document,
					};
				});
				return context;
			},
		},

		validation: {
			onSyntactic(document) {
				return worker(document, (document, vueSourceFile) => {

					const result: vscode.Diagnostic[] = [];
					const sfc = vueSourceFile.sfc;

					if (sfc.scriptSetup && sfc.scriptSetupAst) {
						const scriptSetupRanges = parseScriptSetupRanges(_ts.module, sfc.scriptSetupAst, vueCompilerOptions);
						for (const range of scriptSetupRanges.notOnTopTypeExports) {
							result.push(vscode.Diagnostic.create(
								{
									start: document.positionAt(range.start + sfc.scriptSetup.startTagEnd),
									end: document.positionAt(range.end + sfc.scriptSetup.startTagEnd),
								},
								'type and interface export statements must be on the top in <script setup>',
								vscode.DiagnosticSeverity.Warning,
								undefined,
								'volar',
							));
						}
					}

					const program = _ts.languageService.getProgram();

					if (program && !program.getSourceFile(vueSourceFile.mainScriptName)) {
						for (const script of [sfc.script, sfc.scriptSetup]) {

							if (!script || script.content === '')
								continue;

							const error = vscode.Diagnostic.create(
								{
									start: document.positionAt(script.start),
									end: document.positionAt(script.startTagEnd),
								},
								'Virtual script not found, may missing <script lang="ts"> / "allowJs": true / jsconfig.json.',
								vscode.DiagnosticSeverity.Information,
								undefined,
								'volar',
							);
							result.push(error);
						}
					}

					return result;
				});
			},
		},

		findDocumentSymbols(document) {
			return worker(document, (document, vueSourceFile) => {

				const result: vscode.SymbolInformation[] = [];
				const descriptor = vueSourceFile.sfc;

				if (descriptor.template) {
					result.push({
						name: 'template',
						kind: vscode.SymbolKind.Module,
						location: vscode.Location.create(document.uri, vscode.Range.create(
							document.positionAt(descriptor.template.start),
							document.positionAt(descriptor.template.end),
						)),
					});
				}
				if (descriptor.script) {
					result.push({
						name: 'script',
						kind: vscode.SymbolKind.Module,
						location: vscode.Location.create(document.uri, vscode.Range.create(
							document.positionAt(descriptor.script.start),
							document.positionAt(descriptor.script.end),
						)),
					});
				}
				if (descriptor.scriptSetup) {
					result.push({
						name: 'script setup',
						kind: vscode.SymbolKind.Module,
						location: vscode.Location.create(document.uri, vscode.Range.create(
							document.positionAt(descriptor.scriptSetup.start),
							document.positionAt(descriptor.scriptSetup.end),
						)),
					});
				}
				for (const style of descriptor.styles) {
					result.push({
						name: `${['style', style.scoped ? 'scoped' : undefined, style.module ? 'module' : undefined].filter(shared.notEmpty).join(' ')}`,
						kind: vscode.SymbolKind.Module,
						location: vscode.Location.create(document.uri, vscode.Range.create(
							document.positionAt(style.start),
							document.positionAt(style.end),
						)),
					});
				}
				for (const customBlock of descriptor.customBlocks) {
					result.push({
						name: `${customBlock.type}`,
						kind: vscode.SymbolKind.Module,
						location: vscode.Location.create(document.uri, vscode.Range.create(
							document.positionAt(customBlock.start),
							document.positionAt(customBlock.end),
						)),
					});
				}

				return result;
			});
		},

		getFoldingRanges(document) {
			return worker(document, (document) => {
				return htmlPlugin.getHtmlLs().getFoldingRanges(document);
			});
		},

		getSelectionRanges(document, positions) {
			return worker(document, (document) => {
				return htmlPlugin.getHtmlLs().getSelectionRanges(document, positions);
			});
		},

		format(document) {
			return worker(document, (document, vueSourceFile) => {

				const blocks = [
					vueSourceFile.sfc.script,
					vueSourceFile.sfc.scriptSetup,
					vueSourceFile.sfc.template,
					...vueSourceFile.sfc.styles,
					...vueSourceFile.sfc.customBlocks,
				].filter((block): block is NonNullable<typeof block> => !!block)
					.sort((a, b) => b.start - a.start);

				const edits: vscode.TextEdit[] = [];

				for (const block of blocks) {
					const startPos = document.positionAt(block.start);
					if (startPos.character !== 0) {
						edits.push({
							range: {
								start: {
									line: startPos.line,
									character: 0,
								},
								end: startPos,
							},
							newText: '',
						});
					}
				}

				return edits;
			});
		},
	};

	function apiWithEmptyBlocksDocument<T extends (doc: TextDocument, ...args: any[]) => any>(api: T): T {
		const fn = (doc: TextDocument, ...args: any[]) => {
			return worker(doc, (doc) => {
				return api(doc, ...args);
			});
		};
		return fn as T;
	}

	function worker<T>(document: TextDocument, callback: (emptyBlocksDocument: TextDocument, vueSourceFile: vue.VueFile) => T) {

		const [vueFile] = context.documents.getVirtualFileByUri(document.uri);
		if (vueFile instanceof vue.VueFile) {

			let cache = emptyBlocksDocument.get(document);
			if (!cache || cache[0] !== document.version) {
				cache = [document.version, createEmptyBlocksDocument(document, vueFile)];
			}

			return callback(cache[1], vueFile);
		}
	}
};

function createEmptyBlocksDocument(document: TextDocument, vueSourceFile: vue.VueFile) {
	return TextDocument.create(document.uri, document.languageId, document.version, clearSFCBlocksContents(document.getText(), vueSourceFile));
}

function clearSFCBlocksContents(sfcCode: string, vueSourceFile: vue.VueFile) {

	const descriptor = vueSourceFile.sfc;
	const blocks = [
		descriptor.template,
		descriptor.script,
		descriptor.scriptSetup,
		...descriptor.styles,
		...descriptor.customBlocks,
	].filter(shared.notEmpty);

	for (const block of blocks) {
		const content = sfcCode.substring(block.startTagEnd, block.startTagEnd + block.content.length);
		sfcCode = sfcCode.substring(0, block.startTagEnd)
			+ content.split('\n').map(line => ' '.repeat(line.length)).join('\n')
			+ sfcCode.substring(block.startTagEnd + block.content.length);
	}

	return sfcCode;
}
