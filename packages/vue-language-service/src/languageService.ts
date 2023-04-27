import createCssPlugin from '@volar-plugins/css';
import createEmmetPlugin from '@volar-plugins/emmet';
import createHtmlPlugin from '@volar-plugins/html';
import createJsonPlugin from '@volar-plugins/json';
import createPugPlugin from '@volar-plugins/pug';
import createTsPlugin from '@volar-plugins/typescript';
import createTsTqPlugin from '@volar-plugins/typescript-twoslash-queries';
import * as vue from '@volar/vue-language-core';
import type * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import createVuePlugin from './plugins/vue';
import createAutoDotValuePlugin from './plugins/vue-autoinsert-dotvalue';
import createReferencesCodeLensPlugin from './plugins/vue-codelens-references';
import createTwoslashQueries from './plugins/vue-twoslash-queries';
import createVueTemplateLanguagePlugin from './plugins/vue-template';
import createVisualizeHiddenCallbackParamPlugin from './plugins/vue-visualize-hidden-callback-param';
import type { Data } from '@volar-plugins/typescript/out/services/completions/basic';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { Config, LanguageServicePluginInstance } from '@volar/language-service';
import { hyphenate, capitalize } from '@vue/shared';

import createPugFormatPlugin from '@volar-plugins/pug-beautify';
import createAutoWrapParenthesesPlugin from './plugins/vue-autoinsert-parentheses';
import createAutoAddSpacePlugin from './plugins/vue-autoinsert-space';
import { TagNameCasing, VueCompilerOptions } from './types';
import { getNameCasing } from './ideFeatures/nameCasing';

export interface Settings {
	json?: Parameters<typeof createJsonPlugin>[0];
}

export function resolveConfig(
	config: Config, // volar.config.js
	ts: typeof import('typescript/lib/tsserverlibrary'),
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: Partial<VueCompilerOptions>,
	settings?: Settings,
) {

	const resolvedVueOptions = vue.resolveVueCompilerOptions(vueCompilerOptions);
	const vueLanguageModules = vue.createLanguageModules(ts, compilerOptions, resolvedVueOptions);

	config.languages = Object.assign({}, vueLanguageModules, config.languages);
	config.plugins = resolvePlugins(config.plugins, resolvedVueOptions, settings);

	return config;
}

function resolvePlugins(
	plugins: Config['plugins'],
	vueCompilerOptions: VueCompilerOptions,
	settings?: Settings,
) {

	const originalTsPlugin = plugins?.typescript ?? createTsPlugin();

	plugins ??= {};
	plugins.typescript = (_context): LanguageServicePluginInstance => {

		const base = typeof originalTsPlugin === 'function' ? originalTsPlugin(_context) : originalTsPlugin;

		if (!_context?.typescript)
			return base;

		const ts = _context.typescript.module;
		const autoImportPositions = new WeakSet<vscode.Position>();

		return {
			...base,
			resolveEmbeddedRange(range) {
				if (autoImportPositions.has(range.start) && autoImportPositions.has(range.end))
					return range;
			},
			async provideCompletionItems(document, position, context, item) {
				const result = await base.provideCompletionItems?.(document, position, context, item);
				if (result) {

					// filter __VLS_
					result.items = result.items.filter(item =>
						item.label.indexOf('__VLS_') === -1
						&& (!item.labelDetails?.description || item.labelDetails.description.indexOf('__VLS_') === -1)
					);

					// handle component auto-import patch
					for (const [_, map] of _context.documents.getMapsByVirtualFileUri(document.uri)) {
						const virtualFile = _context.documents.getSourceByUri(map.sourceFileDocument.uri)?.root;
						if (virtualFile instanceof vue.VueFile) {
							const isAutoImport = !!map.toSourcePosition(position, data => typeof data.completion === 'object' && !!data.completion.autoImportOnly);
							if (isAutoImport) {
								result.items.forEach(item => {
									item.data.__isComponentAutoImport = true;
								});

								// fix #2458
								const source = _context.documents.getVirtualFileByUri(document.uri)[1];
								if (source && _context.typescript) {
									const casing = await getNameCasing(_context, _context.typescript, _context.fileNameToUri(source.fileName));
									if (casing.tag === TagNameCasing.Kebab) {
										result.items.forEach(item => {
											item.filterText = hyphenate(item.filterText ?? item.label);
										});
									}
								}
							}
						}
					}
				}
				return result;
			},
			async resolveCompletionItem(item, token) {

				item = await base.resolveCompletionItem?.(item, token) ?? item;

				const itemData = item.data as { uri?: string; } | undefined;

				let newName: string | undefined;

				if (itemData?.uri && item.additionalTextEdits) {
					patchAdditionalTextEdits(itemData.uri, item.additionalTextEdits);
				}

				for (const ext of vueCompilerOptions.extensions) {
					const suffix = capitalize(ext.substring('.'.length)); // .vue -> Vue
					if (
						itemData?.uri
						&& _context.typescript
						&& item.textEdit?.newText.endsWith(suffix)
						&& item.additionalTextEdits?.length === 1 && item.additionalTextEdits[0].newText.indexOf('import ' + item.textEdit.newText + ' from ') >= 0
						&& (await _context.configurationHost?.getConfiguration<boolean>('vue.complete.normalizeComponentImportName') ?? true)
					) {
						newName = item.textEdit.newText.slice(0, -suffix.length);
						newName = newName[0].toUpperCase() + newName.substring(1);
						if (newName === 'Index') {
							const tsItem = (item.data as Data).originalItem;
							if (tsItem.source) {
								const dirs = tsItem.source.split('/');
								if (dirs.length >= 3) {
									newName = dirs[dirs.length - 2];
									newName = newName[0].toUpperCase() + newName.substring(1);
								}
							}
						}
						item.additionalTextEdits[0].newText = item.additionalTextEdits[0].newText.replace(
							'import ' + item.textEdit.newText + ' from ',
							'import ' + newName + ' from ',
						);
						item.textEdit.newText = newName;
						const source = _context.documents.getVirtualFileByUri(itemData.uri)[1];
						if (source) {
							const casing = await getNameCasing(_context, _context.typescript, _context.fileNameToUri(source.fileName));
							if (casing.tag === TagNameCasing.Kebab) {
								item.textEdit.newText = hyphenate(item.textEdit.newText);
							}
						}
					}
					else if (item.textEdit?.newText && new RegExp(`import \\w*${suffix}\\$1 from [\\S\\s]*`).test(item.textEdit.newText)) {
						// https://github.com/johnsoncodehk/volar/issues/2286
						item.textEdit.newText = item.textEdit.newText.replace(`${suffix}$1`, '$1');
					}
				}

				const data: Data = item.data;
				if (item.data?.__isComponentAutoImport && data && item.additionalTextEdits?.length && item.textEdit) {
					for (const [_, map] of _context.documents.getMapsByVirtualFileUri(data.uri)) {
						const virtualFile = _context.documents.getSourceByUri(map.sourceFileDocument.uri)?.root;
						if (virtualFile instanceof vue.VueFile) {
							const sfc = virtualFile.sfc;
							const componentName = newName ?? item.textEdit.newText;
							const textDoc = _context.documents.getDocumentByFileName(virtualFile.snapshot, virtualFile.fileName);
							if (sfc.scriptAst && sfc.script) {
								const _scriptRanges = vue.scriptRanges.parseScriptRanges(ts, sfc.scriptAst, !!sfc.scriptSetup, true);
								const exportDefault = _scriptRanges.exportDefault;
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
										const printText = printer.printNode(ts.EmitHint.Expression, newNode, sfc.scriptAst);
										const editRange = vscode.Range.create(
											textDoc.positionAt(sfc.script.startTagEnd + exportDefault.componentsOption.start),
											textDoc.positionAt(sfc.script.startTagEnd + exportDefault.componentsOption.end),
										);
										autoImportPositions.add(editRange.start);
										autoImportPositions.add(editRange.end);
										item.additionalTextEdits.push(vscode.TextEdit.replace(
											editRange,
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
										const printText = printer.printNode(ts.EmitHint.Expression, newNode, sfc.scriptAst);
										const editRange = vscode.Range.create(
											textDoc.positionAt(sfc.script.startTagEnd + exportDefault.args.start),
											textDoc.positionAt(sfc.script.startTagEnd + exportDefault.args.end),
										);
										autoImportPositions.add(editRange.start);
										autoImportPositions.add(editRange.end);
										item.additionalTextEdits.push(vscode.TextEdit.replace(
											editRange,
											unescape(printText.replace(/\\u/g, '%u')),
										));
									}
								}
							}
						}
					}
				}

				return item;
			},
			async provideCodeActions(document, range, context, token) {
				const result = await base.provideCodeActions?.(document, range, context, token);
				return result?.filter(codeAction => codeAction.title.indexOf('__VLS_') === -1);
			},
			async resolveCodeAction(item, token) {

				const result = await base.resolveCodeAction?.(item, token) ?? item;

				if (result?.edit?.changes) {
					for (const uri in result.edit.changes) {
						const edits = result.edit.changes[uri];
						if (edits) {
							patchAdditionalTextEdits(uri, edits);
						}
					}
				}
				if (result?.edit?.documentChanges) {
					for (const documentChange of result.edit.documentChanges) {
						if (vscode.TextDocumentEdit.is(documentChange)) {
							patchAdditionalTextEdits(documentChange.textDocument.uri, documentChange.edits);
						}
					}
				}

				return result;
			},
		};
	};
	plugins.html ??= createVueTemplateLanguagePlugin({
		templateLanguagePlugin: createHtmlPlugin(),
		getScanner: (document, htmlPlugin): html.Scanner | undefined => {
			return htmlPlugin.getHtmlLs().createScanner(document.getText());
		},
		isSupportedDocument: (document) => document.languageId === 'html',
		vueCompilerOptions,
	});
	plugins.pug ??= createVueTemplateLanguagePlugin({
		templateLanguagePlugin: createPugPlugin() as any,
		getScanner: (document, pugPlugin): html.Scanner | undefined => {
			const pugDocument = (pugPlugin as ReturnType<ReturnType<typeof createPugPlugin>>).getPugDocument(document);
			if (pugDocument) {
				return (pugPlugin as ReturnType<ReturnType<typeof createPugPlugin>>).getPugLs().createScanner(pugDocument);
			}
		},
		isSupportedDocument: (document) => document.languageId === 'jade',
		vueCompilerOptions,
	});
	plugins.vue ??= createVuePlugin();
	plugins.css ??= createCssPlugin();
	plugins['pug-beautify'] ??= createPugFormatPlugin();
	plugins.json ??= createJsonPlugin(settings?.json);
	plugins['typescript/twoslash-queries'] ??= createTsTqPlugin();
	plugins['vue/referencesCodeLens'] ??= createReferencesCodeLensPlugin();
	plugins['vue/autoInsertDotValue'] ??= createAutoDotValuePlugin();
	plugins['vue/twoslash-queries'] ??= createTwoslashQueries();
	plugins['vue/autoInsertParentheses'] ??= createAutoWrapParenthesesPlugin();
	plugins['vue/autoInsertSpaces'] ??= createAutoAddSpacePlugin();
	plugins['vue/visualizeHiddenCallbackParam'] ??= createVisualizeHiddenCallbackParamPlugin();
	plugins.emmet ??= createEmmetPlugin();

	return plugins;
}

// fix https://github.com/johnsoncodehk/volar/issues/916
function patchAdditionalTextEdits(uri: string, edits: vscode.TextEdit[]) {
	if (
		uri.endsWith('.vue.js')
		|| uri.endsWith('.vue.ts')
		|| uri.endsWith('.vue.jsx')
		|| uri.endsWith('.vue.tsx')
	) {
		for (const edit of edits) {
			if (
				edit.range.start.line === 0
				&& edit.range.start.character === 0
				&& edit.range.end.line === 0
				&& edit.range.end.character === 0
			) {
				edit.newText = '\n' + edit.newText;
			}
		}
	}
}
