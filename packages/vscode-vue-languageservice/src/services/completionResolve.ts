import { transformCompletionItem } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import { SourceFile } from '@volar/vue-typescript';
import type { LanguageServiceRuntimeContext } from '../types';
import { CompletionData, HtmlCompletionData, TsCompletionData, AutoImportComponentCompletionData } from '../types';
import * as path from 'upath';
import * as shared from '@volar/shared';
import { camelize, capitalize } from '@vue/shared';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';

export function register({ typescript: ts, sourceFiles, getTsLs, vueHost, scriptTsLs }: LanguageServiceRuntimeContext) {
	return async (item: vscode.CompletionItem, newPosition?: vscode.Position) => {

		// @ts-expect-error
		const data: CompletionData | undefined = item.data;
		if (!data) return item;

		const sourceFile = sourceFiles.get(data.uri);

		if (data.mode === 'ts') {
			return await getTsResult(data);
		}
		if (data.mode === 'html') {
			return await getHtmlResult(item, data);
		}
		if (data.mode === 'autoImport' && sourceFile) {
			return await getAutoImportResult(sourceFile, item, data);
		}

		return item;

		async function getTsResult(data: TsCompletionData) {

			const sourceMap = sourceFiles.getTsSourceMaps(data.lsType).get(data.docUri);
			if (!sourceMap) {
				// take over mode
				return await scriptTsLs.doCompletionResolve(data.tsItem, newPosition);
			}

			let newPosition_2: vscode.Position | undefined;
			if (newPosition) {
				for (const [tsRange] of sourceMap.getMappedRanges(newPosition, newPosition, data => !!data.capabilities.completion)) {
					newPosition_2 = tsRange.start;
					break;
				}
			}
			data.tsItem = await getTsLs(sourceMap.lsType).doCompletionResolve(data.tsItem, newPosition_2);

			// fix https://github.com/johnsoncodehk/volar/issues/916
			if (data.tsItem.additionalTextEdits) {
				for (const edit of data.tsItem.additionalTextEdits) {
					if (
						edit.range.start.line === 0
						&& edit.range.start.character === 0
						&& edit.range.end.line === 0
						&& edit.range.end.character === 0
					) {
						edit.newText = (vueHost.getNewLine?.() ?? '\n') + edit.newText;
					}
				}
			}

			const newVueItem = transformCompletionItem(
				data.tsItem,
				tsRange => sourceMap.getSourceRange(tsRange.start, tsRange.end)?.[0],
			);
			// @ts-expect-error
			newVueItem.data = data;
			// TODO: this is a patch for import ts file icon
			if (newVueItem.detail !== data.tsItem.detail + '.ts') {
				newVueItem.detail = data.tsItem.detail;
			}
			return newVueItem;
		}
		async function getHtmlResult(vueItem: vscode.CompletionItem, data: HtmlCompletionData) {
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
		async function getAutoImportResult(sourceFile: SourceFile, vueItem: vscode.CompletionItem, data: AutoImportComponentCompletionData) {

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
			const planAResult = await planAInsertText();
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
						textDoc.positionAt(descriptor.scriptSetup.startTagEnd + (scriptSetupImport ? scriptSetupImport.end : 0)),
						'\n' + insertText,
					),
				];
			}
			else if (descriptor.script && scriptAst) {
				vueItem.additionalTextEdits = [
					vscode.TextEdit.insert(
						textDoc.positionAt(descriptor.script.startTagEnd + (scriptImport ? scriptImport.end : 0)),
						'\n' + insertText,
					),
				];
				const scriptRanges = parseScriptRanges(ts, scriptAst, !!descriptor.scriptSetup, true, true);
				const exportDefault = scriptRanges.exportDefault;
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
						const printText = printer.printNode(ts.EmitHint.Expression, newNode, scriptAst);
						vueItem.additionalTextEdits.push(vscode.TextEdit.replace(
							vscode.Range.create(
								textDoc.positionAt(descriptor.script.startTagEnd + exportDefault.componentsOption.start),
								textDoc.positionAt(descriptor.script.startTagEnd + exportDefault.componentsOption.end),
							),
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
						const printText = printer.printNode(ts.EmitHint.Expression, newNode, scriptAst);
						vueItem.additionalTextEdits.push(vscode.TextEdit.replace(
							vscode.Range.create(
								textDoc.positionAt(descriptor.script.startTagEnd + exportDefault.args.start),
								textDoc.positionAt(descriptor.script.startTagEnd + exportDefault.args.end),
							),
							unescape(printText.replace(/\\u/g, '%u')),
						));
					}
				}
			}
			return vueItem;

			async function planAInsertText() {
				const scriptDoc = sourceFile.getScriptTsDocument();
				const tsImportName = camelize(path.basename(importFile).replace(/\./g, '-'));
				const [formatOptions, preferences] = await Promise.all([
					vueHost.getFormatOptions?.(scriptDoc) ?? {},
					vueHost.getPreferences?.(scriptDoc) ?? {},
				]);
				const tsDetail = getTsLs('script').__internal__.raw.getCompletionEntryDetails(shared.uriToFsPath(scriptDoc.uri), 0, tsImportName, formatOptions, importFile, preferences, undefined);
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
