import * as createCssPlugin from '@volar-plugins/css';
import * as createEmmetPlugin from '@volar-plugins/emmet';
import * as createHtmlPlugin from '@volar-plugins/html';
import * as createJsonPlugin from '@volar-plugins/json';
import * as createPugPlugin from '@volar-plugins/pug';
import * as createTsPlugin from '@volar-plugins/typescript';
import * as createTsTqPlugin from '@volar-plugins/typescript-twoslash-queries';
import * as embeddedLS from '@volar/language-service';
import * as vue from '@volar/vue-language-core';
import { LanguageServiceHost } from '@volar/language-core';
import type * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import createVuePlugin from './plugins/vue';
import createAutoDotValuePlugin from './plugins/vue-autoinsert-dotvalue';
import createReferencesCodeLensPlugin from './plugins/vue-codelens-references';
import createTwoslashQueries from './plugins/vue-twoslash-queries';
import createVueTemplateLanguagePlugin from './plugins/vue-template';
import type { Data } from '@volar-plugins/typescript/out/services/completions/basic';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { Config } from '@volar/language-service';

import * as createPugFormatPlugin from '@volar-plugins/pug-beautify';
import createAutoWrapParenthesesPlugin from './plugins/vue-autoinsert-parentheses';
import createAutoAddSpacePlugin from './plugins/vue-autoinsert-space';
import { VueCompilerOptions } from './types';

export interface Settings {
	json?: Parameters<typeof createJsonPlugin>[0];
}

export function resolveLanguageServiceConfig(
	host: LanguageServiceHost,
	vueCompilerOptions: VueCompilerOptions,
	config: Config, // volar.config.js
	settings?: Settings,
) {

	const ts = host.getTypeScriptModule?.();
	const vueLanguageModules = ts ? vue.createLanguageModules(
		ts,
		host.getCompilationSettings(),
		vueCompilerOptions,
	) : [];

	config.languages = Object.assign({}, vueLanguageModules, config.languages);
	config.plugins = getLanguageServicePlugins(config.plugins ?? {}, vueCompilerOptions, settings);

	return config;
}

function getLanguageServicePlugins(
	config: Config, // volar.config.js
	vueCompilerOptions: VueCompilerOptions,
	settings?: Settings,
) {

	const baseTsPlugin = config.plugins?.typescript ?? createTsPlugin();
	const tsPlugin: embeddedLS.LanguageServicePlugin = (_context) => {

		if (!_context.typescript)
			return {};

		const ts = _context.typescript.module;
		const base = typeof baseTsPlugin === 'function' ? baseTsPlugin(_context) : baseTsPlugin;
		const autoImportPositions = new WeakSet<vscode.Position>();

		return {
			...base,
			resolveEmbeddedRange(range) {
				if (autoImportPositions.has(range.start) && autoImportPositions.has(range.end))
					return range;
			},
			complete: {
				...base.complete,
				async on(document, position, context) {
					const result = await base.complete?.on?.(document, position, context);
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
								if (map.toSourcePosition(position, data => typeof data.completion === 'object' && !!data.completion.autoImportOnly)) {
									result.items.forEach(item => {
										item.data.__isComponentAutoImport = true;
									});
								}
							}
						}
					}
					return result;
				},
				async resolve(item) {

					item = await base.complete!.resolve!(item);

					const itemData = item.data as { uri?: string; } | undefined;

					if (itemData?.uri && item.additionalTextEdits) {
						patchAdditionalTextEdits(itemData.uri, item.additionalTextEdits);
					}

					if (
						item.textEdit?.newText && /\w*Vue$/.test(item.textEdit.newText)
						&& item.additionalTextEdits?.length === 1 && item.additionalTextEdits[0].newText.indexOf('import ' + item.textEdit.newText + ' from ') >= 0
						&& (await _context.env.configurationHost?.getConfiguration<boolean>('volar.completion.normalizeComponentImportName') ?? true)
					) {
						let newName = item.textEdit.newText.slice(0, -'Vue'.length);
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
					}
					else if (
						item.textEdit?.newText && /import \w*Vue\$1 from \S*/.test(item.textEdit.newText)
						&& !item.additionalTextEdits?.length
					) {
						// https://github.com/johnsoncodehk/volar/issues/2286
						item.textEdit.newText = item.textEdit.newText.replace('Vue$1', '');
					}

					const data: Data = item.data;
					if (item.data?.__isComponentAutoImport && data && item.additionalTextEdits?.length && item.textEdit) {
						for (const [_, map] of _context.documents.getMapsByVirtualFileUri(data.uri)) {
							const virtualFile = _context.documents.getSourceByUri(map.sourceFileDocument.uri)?.root;
							if (virtualFile instanceof vue.VueFile) {
								const sfc = virtualFile.sfc;
								const componentName = item.textEdit.newText;
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
			},
			codeAction: {
				...base.codeAction,
				async on(document, range, context) {
					const result = await base.codeAction?.on?.(document, range, context);
					return result?.filter(codeAction => codeAction.title.indexOf('__VLS_') === -1);
				},
				async resolve(item) {

					const result = await base.codeAction?.resolve?.(item);

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
			}
		};
	};

	// template plugins
	const htmlPlugin = createVueTemplateLanguagePlugin({
		templateLanguagePlugin: createHtmlPlugin(),
		getScanner: (document, htmlPlugin): html.Scanner | undefined => {
			return htmlPlugin.getHtmlLs().createScanner(document.getText());
		},
		isSupportedDocument: (document) => document.languageId === 'html',
		vueCompilerOptions,
	});
	const pugPlugin = createVueTemplateLanguagePlugin({
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

	return {
		vue: createVuePlugin(vueCompilerOptions),
		css: createCssPlugin(),
		html: htmlPlugin,
		pug: pugPlugin,
		'pug-beautify': createPugFormatPlugin(),
		json: createJsonPlugin(settings?.json),
		'typescript/twoslash-queries': createTsTqPlugin(),
		'vue/referencesCodeLens': createReferencesCodeLensPlugin(),
		'vue/autoInsertDotValue': createAutoDotValuePlugin(),
		'vue/twoslash-queries': createTwoslashQueries(),
		'vue/autoInsertParentheses': createAutoWrapParenthesesPlugin(),
		'vue/autoInsertSpaces': createAutoAddSpacePlugin(),
		// put emmet plugin at last to fix https://github.com/johnsoncodehk/volar/issues/1088
		emmet: createEmmetPlugin(),

		...config.plugins,
		typescript: tsPlugin, // override config.plugins.typescript
	};
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
