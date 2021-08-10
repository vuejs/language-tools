import { transformCompletionItem } from '@volar/transforms';
import * as vscode from 'vscode-languageserver';
import { SourceFile } from '../sourceFile';
import type { ApiLanguageServiceContext } from '../types';
import { CompletionData, HtmlCompletionData, TsCompletionData, AutoImportComponentCompletionData } from '../types';
import * as path from 'upath';
import * as shared from '@volar/shared';
import { camelize, capitalize } from '@vue/shared';
import { parseScriptRanges } from '../parsers/scriptRanges';

export function register({ modules: { typescript: ts }, sourceFiles, getTsLs, vueHost }: ApiLanguageServiceContext) {
	return async (item: vscode.CompletionItem, newPosition?: vscode.Position) => {

		const data: CompletionData | undefined = item.data;
		if (!data) return item;

		const sourceFile = sourceFiles.get(data.uri);
		if (!sourceFile) return item;

		if (data.mode === 'ts') {
			return await getTsResult(sourceFile, item, data);
		}
		if (data.mode === 'html') {
			return await getHtmlResult(sourceFile, item, data);
		}
		if (data.mode === 'autoImport') {
			return getAutoImportResult(sourceFile, item, data);
		}

		return item;

		async function getTsResult(sourceFile: SourceFile, vueItem: vscode.CompletionItem, data: TsCompletionData) {
			const sourceMap = sourceFiles.getTsSourceMaps(data.lsType).get(data.docUri);
			if (sourceMap) {
				let newPosition_2: vscode.Position | undefined;
				if (newPosition) {
					for (const tsRange of sourceMap.getMappedRanges(newPosition)) {
						if (!tsRange.data.capabilities.completion) continue;
						newPosition_2 = tsRange.start;
						break;
					}
				}
				data.tsItem = await getTsLs(sourceMap.lsType).doCompletionResolve(data.tsItem, newPosition_2);
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
		async function getHtmlResult(sourceFile: SourceFile, vueItem: vscode.CompletionItem, data: HtmlCompletionData) {
			let tsItem: vscode.CompletionItem | undefined = data.tsItem;
			if (!tsItem) return vueItem;

			tsItem = await getTsLs('template').doCompletionResolve(tsItem);
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
					kind: vscode.MarkupKind.Markdown,
					value: documentations.join('\n\n'),
				};
			}

			return vueItem;
		}
		function getAutoImportResult(sourceFile: SourceFile, vueItem: vscode.CompletionItem, data: AutoImportComponentCompletionData) {


			const importFile = shared.uriToFsPath(data.importUri);
			const rPath = path.relative(vueHost.getCurrentDirectory(), importFile);
			const descriptor = sourceFile.getDescriptor();
			const scriptAst = sourceFile.getScriptAst();
			const scriptSetupAst = sourceFile.getScriptSetupAst();

			let importPath = path.relative(path.dirname(data.uri), data.importUri);
			if (!importPath.startsWith('.')) {
				importPath = './' + importPath;
			}

			if (!descriptor.scriptSetup && !descriptor.script) {
				vueItem.detail = `Auto import from '${importPath}'\n\n${rPath}`;
				vueItem.documentation = {
					kind: vscode.MarkupKind.Markdown,
					value: '[Error] `<script>` / `<script setup>` block not found.',
				};
				return vueItem;
			}

			vueItem.labelDetails = { description: rPath };

			const scriptImport = scriptAst ? getLastImportNode(scriptAst) : undefined;
			const scriptSetupImport = scriptSetupAst ? getLastImportNode(scriptSetupAst) : undefined;
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
					vscode.TextEdit.insert(
						textDoc.positionAt(descriptor.scriptSetup.loc.start + (scriptSetupImport ? scriptSetupImport.end : 0)),
						'\n' + insertText,
					),
				];
			}
			else if (descriptor.script && scriptAst) {
				vueItem.additionalTextEdits = [
					vscode.TextEdit.insert(
						textDoc.positionAt(descriptor.script.loc.start + (scriptImport ? scriptImport.end : 0)),
						'\n' + insertText,
					),
				];
				const scriptRanges = parseScriptRanges(ts, scriptAst, true, true);
				const exportDefault = scriptRanges.exportDefault;
				if (exportDefault) {
					// https://github.com/microsoft/TypeScript/issues/36174
					const printer = ts.createPrinter();
					if (exportDefault.componentsOption && exportDefault.componentsOptionNode) {
						(exportDefault.componentsOptionNode.properties as any as ts.ObjectLiteralElementLike[]).push(ts.factory.createShorthandPropertyAssignment(componentName))
						const printText = printer.printNode(ts.EmitHint.Expression, exportDefault.componentsOptionNode, scriptAst);
						vueItem.additionalTextEdits.push(vscode.TextEdit.replace(
							vscode.Range.create(
								textDoc.positionAt(descriptor.script.loc.start + exportDefault.componentsOption.start),
								textDoc.positionAt(descriptor.script.loc.start + exportDefault.componentsOption.end),
							),
							unescape(printText.replace(/\\u/g, '%u')),
						));
					}
					else if (exportDefault.args && exportDefault.argsNode) {
						(exportDefault.argsNode.properties as any as ts.ObjectLiteralElementLike[]).push(ts.factory.createShorthandPropertyAssignment(`components: { ${componentName} }`));
						const printText = printer.printNode(ts.EmitHint.Expression, exportDefault.argsNode, scriptAst);
						vueItem.additionalTextEdits.push(vscode.TextEdit.replace(
							vscode.Range.create(
								textDoc.positionAt(descriptor.script.loc.start + exportDefault.args.start),
								textDoc.positionAt(descriptor.script.loc.start + exportDefault.args.end),
							),
							unescape(printText.replace(/\\u/g, '%u')),
						));
					}
				}
			}
			return vueItem;

			function planAInsertText() {
				const scriptUrl = sourceFile.getScriptTsDocument().uri;
				const tsImportName = camelize(path.basename(importFile).replace(/\./g, '-'));
				const tsDetail = getTsLs('script').__internal__.raw.getCompletionEntryDetails(shared.uriToFsPath(scriptUrl), 0, tsImportName, {}, importFile, undefined, undefined);
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

	function getLastImportNode(ast: ts.SourceFile) {
		let importNode: ts.ImportDeclaration | undefined;
		ast.forEachChild(node => {
			if (ts.isImportDeclaration(node)) {
				importNode = node;
			}
		});
		return importNode ? {
			text: importNode.getFullText(ast).trim(),
			end: importNode.getEnd(),
		} : undefined;
	}
}
