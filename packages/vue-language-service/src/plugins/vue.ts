import { Service } from '@volar/language-service';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import createHtmlPlugin from 'volar-service-html';
import * as vue from '@volar/vue-language-core';
import { loadLanguageBlocks } from './data';

let sfcDataProvider: html.IHTMLDataProvider | undefined;

export default (): Service => (context) => {

	const htmlPlugin = createHtmlPlugin({ validLang: 'vue', disableCustomData: true })(context);

	if (!context?.typescript)
		return htmlPlugin;

	sfcDataProvider ??= html.newHTMLDataProvider('vue', loadLanguageBlocks(context.env.locale ?? 'en'));

	htmlPlugin.getHtmlLs().setDataProviders(false, [sfcDataProvider]);

	const _ts = context.typescript;

	return {

		...htmlPlugin,

		resolveRuleContext(context) {
			worker(context.document, (vueSourceFile) => {
				if (vueSourceFile.parsedSfc) {
					context.vue = {
						sfc: vueSourceFile.parsedSfc,
						templateAst: vueSourceFile.sfc.templateAst,
						scriptAst: vueSourceFile.sfc.scriptAst,
						scriptSetupAst: vueSourceFile.sfc.scriptSetupAst,
					};
				}
			});
			return context;
		},

		provideSemanticDiagnostics(document) {
			return worker(document, (vueSourceFile) => {

				const result: vscode.Diagnostic[] = [];
				const sfc = vueSourceFile.sfc;
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
							`Virtual script ${JSON.stringify(vueSourceFile.mainScriptName)} not found, may missing <script lang="ts"> / "allowJs": true / jsconfig.json.`,
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

		findDocumentLinks: undefined,

		provideDocumentSymbols(document) {
			return worker(document, (vueSourceFile) => {

				const result: vscode.DocumentSymbol[] = [];
				const descriptor = vueSourceFile.sfc;

				if (descriptor.template) {
					result.push({
						name: 'template',
						kind: vscode.SymbolKind.Module,
						range: vscode.Range.create(
							document.positionAt(descriptor.template.start),
							document.positionAt(descriptor.template.end),
						),
						selectionRange: vscode.Range.create(
							document.positionAt(descriptor.template.start),
							document.positionAt(descriptor.template.startTagEnd),
						),
					});
				}
				if (descriptor.script) {
					result.push({
						name: 'script',
						kind: vscode.SymbolKind.Module,
						range: vscode.Range.create(
							document.positionAt(descriptor.script.start),
							document.positionAt(descriptor.script.end),
						),
						selectionRange: vscode.Range.create(
							document.positionAt(descriptor.script.start),
							document.positionAt(descriptor.script.startTagEnd),
						),
					});
				}
				if (descriptor.scriptSetup) {
					result.push({
						name: 'script setup',
						kind: vscode.SymbolKind.Module,
						range: vscode.Range.create(
							document.positionAt(descriptor.scriptSetup.start),
							document.positionAt(descriptor.scriptSetup.end),
						),
						selectionRange: vscode.Range.create(
							document.positionAt(descriptor.scriptSetup.start),
							document.positionAt(descriptor.scriptSetup.startTagEnd),
						),
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
						kind: vscode.SymbolKind.Module,
						range: vscode.Range.create(
							document.positionAt(style.start),
							document.positionAt(style.end),
						),
						selectionRange: vscode.Range.create(
							document.positionAt(style.start),
							document.positionAt(style.startTagEnd),
						),
					});
				}
				for (const customBlock of descriptor.customBlocks) {
					result.push({
						name: `${customBlock.type}`,
						kind: vscode.SymbolKind.Module,
						range: vscode.Range.create(
							document.positionAt(customBlock.start),
							document.positionAt(customBlock.end),
						),
						selectionRange: vscode.Range.create(
							document.positionAt(customBlock.start),
							document.positionAt(customBlock.startTagEnd),
						),
					});
				}

				return result;
			});
		},

		provideDocumentFormattingEdits(document) {
			return worker(document, (vueSourceFile) => {

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

	function worker<T>(document: TextDocument, callback: (vueSourceFile: vue.VueFile) => T) {
		const [vueFile] = context!.documents.getVirtualFileByUri(document.uri);
		if (vueFile instanceof vue.VueFile) {
			return callback(vueFile);
		}
	}
};
