import { transformCompletionItem } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as path from 'upath';
import * as shared from '@volar/shared';
import { camelize, capitalize } from '@vue/shared';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { AutoImportCompletionData, CompletionData, HtmlCompletionData, PluginCompletionData } from './completion';

export function register({ typescript: ts, sourceFiles, getTsLs, vueHost, getPluginById }: LanguageServiceRuntimeContext) {
	return async (item: vscode.CompletionItem, newPosition?: vscode.Position) => {

		const data: CompletionData | undefined = item.data as any;

		if (data?.mode === 'plugin') {
			await pluginWorker(data);
		}
		else if (data?.mode === 'html') {
			await htmlWorker(data)
		}
		else if (data?.mode === 'autoImport') {
			await componentAutoImportWorker(data);
		}

		// fix https://github.com/johnsoncodehk/volar/issues/916
		if (item.additionalTextEdits) {
			for (const edit of item.additionalTextEdits) {
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

		// TODO: monky fix import ts file icon
		if (item.detail !== item.detail + '.ts') {
			item.detail = item.detail;
		}

		return item;

		async function pluginWorker(data: PluginCompletionData) {

			const plugin = getPluginById(data.pluginId);

			if (!plugin)
				return item;

			if (!plugin.doCompleteResolve)
				return item;

			const originalItem = data.originalItem;

			if (data.sourceMapId !== undefined && data.embeddedDocumentUri !== undefined) {

				const sourceMap = sourceFiles.getSourceMap(data.sourceMapId, data.embeddedDocumentUri);

				if (sourceMap) {

					const newPosition_2 = newPosition
						? sourceMap.getMappedRange(newPosition, newPosition, data => !!data.capabilities.completion)?.[0].start
						: undefined;
					const resolvedItem = await plugin.doCompleteResolve(originalItem, newPosition_2);

					item = transformCompletionItem(
						resolvedItem,
						embeddedRange => sourceMap.getSourceRange(embeddedRange.start, embeddedRange.end)?.[0],
					);
				}
			}
			else {
				item = await plugin.doCompleteResolve(originalItem);
			}
		}

		async function htmlWorker(data: HtmlCompletionData) {

			let tsItem: vscode.CompletionItem | undefined = data.tsItem;
			if (!tsItem) return item;

			tsItem = await getTsLs('template').doCompletionResolve(tsItem);
			item.tags = [...item.tags ?? [], ...tsItem.tags ?? []];

			const details: string[] = [];
			const documentations: string[] = [];

			if (item.detail) details.push(item.detail);
			if (tsItem.detail) details.push(tsItem.detail);
			if (details.length) {
				item.detail = details.join('\n\n');
			}

			if (item.documentation) documentations.push(typeof item.documentation === 'string' ? item.documentation : item.documentation.value);
			if (tsItem.documentation) documentations.push(typeof tsItem.documentation === 'string' ? tsItem.documentation : tsItem.documentation.value);
			if (documentations.length) {
				item.documentation = {
					kind: vscode.MarkupKind.Markdown,
					value: documentations.join('\n\n'),
				};
			}

			return item;
		}

		async function componentAutoImportWorker(data: AutoImportCompletionData) {

			const _sourceFile = sourceFiles.get(data.uri);
			if (!_sourceFile)
				return;

			const sourceFile = _sourceFile;
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
				item.detail = `Auto import from '${importPath}'\n\n${rPath}`;
				item.documentation = {
					kind: vscode.MarkupKind.Markdown,
					value: '[Error] `<script>` / `<script setup>` block not found.',
				};
				return;
			}

			item.labelDetails = { description: rPath };

			const scriptImport = scriptAst ? getLastImportNode(scriptAst) : undefined;
			const scriptSetupImport = scriptSetupAst ? getLastImportNode(scriptSetupAst) : undefined;
			const componentName = capitalize(camelize(item.label));
			const textDoc = sourceFile.getTextDocument();
			let insertText = '';
			const planAResult = await planAInsertText();
			if (planAResult) {
				insertText = planAResult.insertText;
				item.detail = planAResult.description + '\n\n' + rPath;
			}
			else {
				insertText = planBInsertText();
				item.detail = `Auto import from '${importPath}'\n\n${rPath}`;
			}
			if (descriptor.scriptSetup) {
				item.additionalTextEdits = [
					vscode.TextEdit.insert(
						textDoc.positionAt(descriptor.scriptSetup.startTagEnd + (scriptSetupImport ? scriptSetupImport.end : 0)),
						'\n' + insertText,
					),
				];
			}
			else if (descriptor.script && scriptAst) {
				item.additionalTextEdits = [
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
						item.additionalTextEdits.push(vscode.TextEdit.replace(
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
						item.additionalTextEdits.push(vscode.TextEdit.replace(
							vscode.Range.create(
								textDoc.positionAt(descriptor.script.startTagEnd + exportDefault.args.start),
								textDoc.positionAt(descriptor.script.startTagEnd + exportDefault.args.end),
							),
							unescape(printText.replace(/\\u/g, '%u')),
						));
					}
				}
			}
			return item;

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
