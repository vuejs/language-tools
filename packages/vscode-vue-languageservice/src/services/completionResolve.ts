import { transformCompletionItem } from '@volar/transforms';
import { CompletionItem, MarkupKind, TextEdit, Range } from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFile';
import type { TsApiRegisterOptions } from '../types';
import { CompletionData, HtmlCompletionData, TsCompletionData, AutoImportComponentCompletionData } from '../types';
import * as path from 'upath';
import { uriToFsPath } from '@volar/shared';
import { camelize, capitalize } from '@vue/shared';
import { parse as parseScriptAst } from '../parsers/scriptAst';

export function register({ sourceFiles, tsLanguageService, ts, vueHost }: TsApiRegisterOptions) {
	return (item: CompletionItem, newOffset?: number) => {

		const data: CompletionData | undefined = item.data;
		if (!data) return item;

		const sourceFile = sourceFiles.get(data.uri);
		if (!sourceFile) return item;

		if (data.mode === 'ts') {
			return getTsResult(sourceFile, item, data);
		}
		if (data.mode === 'html') {
			return getHtmlResult(sourceFile, item, data);
		}
		if (data.mode === 'autoImport') {
			return getAutoImportResult(sourceFile, item, data);
		}

		return item;

		function getTsResult(sourceFile: SourceFile, vueItem: CompletionItem, data: TsCompletionData) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				if (sourceMap.mappedDocument.uri !== data.docUri) continue;

				let newTsOffset: number | undefined;
				if (newOffset) {
					for (const tsRange of sourceMap.getMappedRanges2(newOffset)) {
						if (!tsRange.data.capabilities.completion) continue;
						newTsOffset = tsRange.start;
						break;
					}
				}
				data.tsItem = tsLanguageService.doCompletionResolve(data.tsItem, newTsOffset);
				const newVueItem = transformCompletionItem(
					data.tsItem,
					tsRange => sourceMap.getSourceRange(tsRange.start, tsRange.end),
				);
				newVueItem.data = data;
				// TODO: this is a patch for import ts file icon
				if (newVueItem.detail !== data.tsItem.detail + '.ts') {
					newVueItem.detail = data.tsItem.detail;
				}
				return newVueItem;
			}
			return vueItem;
		}
		function getHtmlResult(sourceFile: SourceFile, vueItem: CompletionItem, data: HtmlCompletionData) {
			let tsItem: CompletionItem | undefined = data.tsItem;
			if (!tsItem) return vueItem;

			tsItem = tsLanguageService.doCompletionResolve(tsItem);
			vueItem.tags = [...vueItem.tags ?? [], ...tsItem.tags ?? []];

			const details: string[] = [];
			const documentations: string[] = [];

			if (vueItem.detail) details.push(vueItem.detail);
			if (tsItem.detail) details.push(tsItem.detail);
			if (details.length) {
				vueItem.detail = details.join('\n\n');
			}

			if (vueItem.documentation) documentations.push(typeof vueItem.documentation === 'string' ? vueItem.documentation : vueItem.documentation.value);
			if (tsItem.documentation) documentations.push(typeof tsItem.documentation === 'string' ? tsItem.documentation : tsItem.documentation.value);
			if (documentations.length) {
				vueItem.documentation = {
					kind: MarkupKind.Markdown,
					value: documentations.join('\n\n'),
				};
			}

			return vueItem;
		}
		function getAutoImportResult(sourceFile: SourceFile, vueItem: CompletionItem, data: AutoImportComponentCompletionData) {
			const importFile = uriToFsPath(data.importUri);
			const rPath = path.relative(vueHost.getCurrentDirectory(), importFile);
			let importPath = path.relative(path.dirname(data.uri), data.importUri);
			if (!importPath.startsWith('.')) {
				importPath = './' + importPath;
			}
			vueItem.labelDetails = { qualifier: rPath };
			const descriptor = sourceFile.getDescriptor();
			const scriptImport = descriptor.script ? getLastImportNode(descriptor.script.content) : undefined;
			const scriptSetupImport = descriptor.scriptSetup ? getLastImportNode(descriptor.scriptSetup.content) : undefined;
			const componentName = capitalize(camelize(vueItem.label));
			const textDoc = sourceFile.getTextDocument();
			let insertText = '';
			const planAResult = planAInsertText();
			if (planAResult) {
				insertText = planAResult.insertText;
				vueItem.detail = planAResult.description + '\n\n' + rPath;
			}
			else {
				insertText = planBInsertText();
				vueItem.detail = `Auto import from '${importPath}'\n\n${rPath}`;
			}
			if (descriptor.scriptSetup) {
				vueItem.additionalTextEdits = [
					TextEdit.insert(
						textDoc.positionAt(descriptor.scriptSetup.loc.start + (scriptSetupImport ? scriptSetupImport.end : 0)),
						'\n' + insertText,
					),
				];
			}
			else if (descriptor.script) {
				vueItem.additionalTextEdits = [
					TextEdit.insert(
						textDoc.positionAt(descriptor.script.loc.start + (scriptImport ? scriptImport.end : 0)),
						'\n' + insertText,
					),
				];
				const scriptAst = parseScriptAst(ts, descriptor.script.content, true, true);
				const exportDefault = scriptAst.exportDefault;
				if (exportDefault) {
					const printer = ts.createPrinter();
					if (exportDefault.componentsOption && exportDefault.componentsOptionNode) {
						(exportDefault.componentsOptionNode.properties as any as ts.ObjectLiteralElementLike[]).push(ts.factory.createShorthandPropertyAssignment(componentName))
						const printText = printer.printNode(ts.EmitHint.Expression, exportDefault.componentsOptionNode, scriptAst.sourceFile);
						vueItem.additionalTextEdits.push(TextEdit.replace(
							Range.create(
								textDoc.positionAt(descriptor.script.loc.start + exportDefault.componentsOption.start),
								textDoc.positionAt(descriptor.script.loc.start + exportDefault.componentsOption.end),
							),
							printText,
						));
					}
					else if (exportDefault.args && exportDefault.argsNode) {
						(exportDefault.argsNode.properties as any as ts.ObjectLiteralElementLike[]).push(ts.factory.createShorthandPropertyAssignment(`components: { ${componentName} }`));
						const printText = printer.printNode(ts.EmitHint.Expression, exportDefault.argsNode, scriptAst.sourceFile);
						vueItem.additionalTextEdits.push(TextEdit.replace(
							Range.create(
								textDoc.positionAt(descriptor.script.loc.start + exportDefault.args.start),
								textDoc.positionAt(descriptor.script.loc.start + exportDefault.args.end),
							),
							printText,
						));
					}
				}
			}
			return vueItem;

			function planAInsertText() {

				const scriptUrl = sourceFile.getVirtualScriptUri();
				if (!scriptUrl) return;

				const tsImportName = camelize(path.basename(importFile).replace(/\./g, '-'));
				const tsDetail = tsLanguageService.__internal__.raw.getCompletionEntryDetails(uriToFsPath(scriptUrl), 0, tsImportName, {}, importFile, undefined, undefined);
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
			function planBInsertText() {
				const anyImport = scriptSetupImport ?? scriptImport;
				let withSemicolon = true;
				let quote = '"';
				if (anyImport) {
					withSemicolon = anyImport.text.endsWith(';');
					quote = anyImport.text.includes("'") ? "'" : '"';
				}
				return `import ${componentName} from ${quote}${importPath}${quote}${withSemicolon ? ';' : ''}`;
			}
		}
	}

	function getLastImportNode(code: string) {
		const sourceFile = ts.createSourceFile('', code, ts.ScriptTarget.Latest);
		let importNode: ts.ImportDeclaration | undefined;
		sourceFile.forEachChild(node => {
			if (ts.isImportDeclaration(node)) {
				importNode = node;
			}
		});
		return importNode ? {
			text: importNode.getFullText(sourceFile).trim(),
			end: importNode.getEnd(),
		} : undefined;
	}
}
