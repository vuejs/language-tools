import * as shared from '@volar/shared';
import { parseScriptSetupRanges } from '@volar/vue-language-core';
import { LanguageServicePlugin, LanguageServicePluginContext, SourceFileDocument } from '@volar/language-service';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import useHtmlPlugin from '@volar-plugins/html';
import * as vue from '@volar/vue-language-core';

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

export default function (options: {
	getVueDocument(document: TextDocument): SourceFileDocument | undefined,
}): LanguageServicePlugin {

	const htmlPlugin = useHtmlPlugin({
		validLang: 'vue',
		disableCustomData: true,
	});
	const emptyBlocksDocument = new WeakMap<TextDocument, [number, TextDocument]>();

	let context: LanguageServicePluginContext;

	if (htmlPlugin.complete?.on) {
		htmlPlugin.complete.on = apiWithEmptyBlocksDocument(htmlPlugin.complete.on);
	}

	return {

		...htmlPlugin,

		setup(_context) {
			htmlPlugin.setup?.(_context);
			htmlPlugin.getHtmlLs().setDataProviders(false, [dataProvider]);
			context = _context;
		},

		validation: {
			onSyntactic(document) {
				return worker(document, (document, vueDocument, vueSourceFile) => {

					const result: vscode.Diagnostic[] = [];
					const sfc = vueSourceFile.sfc;

					if (sfc.scriptSetup && sfc.scriptSetupAst) {
						const scriptSetupRanges = parseScriptSetupRanges(context.typescript.module, sfc.scriptSetupAst);
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

					const program = context.typescript.languageService.getProgram();

					if (program && !program.getSourceFile(vueSourceFile.tsFileName)) {
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
			return worker(document, (document, vueDocument, vueSourceFile) => {

				const result: vscode.SymbolInformation[] = [];
				const descriptor = vueSourceFile.sfc;

				if (descriptor.template) {
					result.push({
						name: 'template',
						kind: vscode.SymbolKind.Module,
						location: vscode.Location.create(document.uri, vscode.Range.create(
							document.positionAt(descriptor.template.startTagEnd),
							document.positionAt(descriptor.template.startTagEnd + descriptor.template.content.length),
						)),
					});
				}
				if (descriptor.script) {
					result.push({
						name: 'script',
						kind: vscode.SymbolKind.Module,
						location: vscode.Location.create(document.uri, vscode.Range.create(
							document.positionAt(descriptor.script.startTagEnd),
							document.positionAt(descriptor.script.startTagEnd + descriptor.script.content.length),
						)),
					});
				}
				if (descriptor.scriptSetup) {
					result.push({
						name: 'script setup',
						kind: vscode.SymbolKind.Module,
						location: vscode.Location.create(document.uri, vscode.Range.create(
							document.positionAt(descriptor.scriptSetup.startTagEnd),
							document.positionAt(descriptor.scriptSetup.startTagEnd + descriptor.scriptSetup.content.length),
						)),
					});
				}
				for (const style of descriptor.styles) {
					result.push({
						name: `${['style', style.scoped ? 'scoped' : undefined, style.module ? 'module' : undefined].filter(shared.notEmpty).join(' ')}`,
						kind: vscode.SymbolKind.Module,
						location: vscode.Location.create(document.uri, vscode.Range.create(
							document.positionAt(style.startTagEnd),
							document.positionAt(style.startTagEnd + style.content.length),
						)),
					});
				}
				for (const customBlock of descriptor.customBlocks) {
					result.push({
						name: `${customBlock.type}`,
						kind: vscode.SymbolKind.Module,
						location: vscode.Location.create(document.uri, vscode.Range.create(
							document.positionAt(customBlock.startTagEnd),
							document.positionAt(customBlock.startTagEnd + customBlock.content.length),
						)),
					});
				}

				return result;
			});
		},

		getFoldingRanges(document) {
			return worker(document, (document, vueDocument, vueSourceFile) => {
				return htmlPlugin.getHtmlLs().getFoldingRanges(document);
			});
		},

		getSelectionRanges(document, positions) {
			return worker(document, (document, vueDocument, vueSourceFile) => {
				return htmlPlugin.getHtmlLs().getSelectionRanges(document, positions);
			});
		},

		format(document) {
			return worker(document, (document, vueDocument, vueSourceFile) => {

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

	function worker<T>(document: TextDocument, callback: (emptyBlocksDocument: TextDocument, vueDocument: SourceFileDocument, vueSourceFile: vue.VueSourceFile) => T) {

		const vueDocument = options.getVueDocument(document);
		if (!vueDocument)
			return;

		if (!(vueDocument.file instanceof vue.VueSourceFile))
			return;

		let cache = emptyBlocksDocument.get(document);
		if (!cache || cache[0] !== document.version) {
			cache = [document.version, createEmptyBlocksDocument(document, vueDocument.file)];
		}

		return callback(cache[1], vueDocument, vueDocument.file);
	}

}

function createEmptyBlocksDocument(document: TextDocument, vueSourceFile: vue.VueSourceFile) {
	return TextDocument.create(document.uri, document.languageId, document.version, clearSFCBlocksContents(document.getText(), vueSourceFile));
}

function clearSFCBlocksContents(sfcCode: string, vueSourceFile: vue.VueSourceFile) {

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
