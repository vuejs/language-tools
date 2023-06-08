import { Config, Service } from '@volar/language-service';
import * as vue from '@vue/language-core';
import { capitalize, hyphenate } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import createCssService from 'volar-service-css';
import createEmmetService from 'volar-service-emmet';
import createHtmlService from 'volar-service-html';
import createJsonService from 'volar-service-json';
import createPugService from 'volar-service-pug';
import createPugFormatService from 'volar-service-pug-beautify';
import createTsService from 'volar-service-typescript';
import createTsTqService from 'volar-service-typescript-twoslash-queries';
import type { Data } from 'volar-service-typescript/out/services/completions/basic';
import type * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver-protocol';
import { getNameCasing } from './ideFeatures/nameCasing';
import createVueService from './plugins/vue';
import createAutoDotValueService from './plugins/vue-autoinsert-dotvalue';
import createAutoWrapParenthesesService from './plugins/vue-autoinsert-parentheses';
import createAutoAddSpaceService from './plugins/vue-autoinsert-space';
import createReferencesCodeLensService from './plugins/vue-codelens-references';
import createVueTemplateLanguageService from './plugins/vue-template';
import createVueTqService from './plugins/vue-twoslash-queries';
import createVisualizeHiddenCallbackParamService from './plugins/vue-visualize-hidden-callback-param';
import { TagNameCasing, VueCompilerOptions } from './types';

export interface Settings {
	json?: Parameters<typeof createJsonService>[0];
}

export function resolveConfig(
	config: Config,
	compilerOptions: ts.CompilerOptions = {},
	vueCompilerOptions: Partial<vue.VueCompilerOptions> = {},
	ts: typeof import('typescript/lib/tsserverlibrary') = require('typescript'),
	settings?: Settings,
	codegenStack: boolean = false,
) {

	const resolvedVueCompilerOptions = vue.resolveVueCompilerOptions(vueCompilerOptions);
	const vueLanguageModules = vue.createLanguages(compilerOptions, resolvedVueCompilerOptions, ts, codegenStack);

	config.languages = Object.assign({}, vueLanguageModules, config.languages);
	config.services = resolvePlugins(config.services, resolvedVueCompilerOptions, settings);

	return config;
}

function resolvePlugins(
	services: Config['services'],
	vueCompilerOptions: VueCompilerOptions,
	settings?: Settings,
) {

	const originalTsPlugin: Service = services?.typescript ?? createTsService();

	services ??= {};
	services.typescript = (_context, modules): ReturnType<Service> => {

		const base = typeof originalTsPlugin === 'function' ? originalTsPlugin(_context, modules) : originalTsPlugin;

		if (!_context || !modules?.typescript)
			return base;

		const ts = modules.typescript;
		const transformedItem = new WeakSet<vscode.CompletionItem>();

		return {
			...base,
			transformCompletionItem(item) {
				if (transformedItem.has(item)) {
					return item;
				}
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
					let casing: Awaited<ReturnType<typeof getNameCasing>> | undefined;

					for (const [_, map] of _context.documents.getMapsByVirtualFileUri(document.uri)) {
						const virtualFile = _context.documents.getSourceByUri(map.sourceFileDocument.uri)?.root;
						if (virtualFile instanceof vue.VueFile) {
							const isAutoImport = !!map.toSourcePosition(position, data => typeof data.completion === 'object' && !!data.completion.autoImportOnly);
							if (isAutoImport) {
								const source = _context.documents.getVirtualFileByUri(document.uri)[1];
								for (const item of result.items) {
									item.data.__isComponentAutoImport = true;
								}

								// fix #2458
								if (source) {
									casing ??= await getNameCasing(ts, _context, _context.env.fileNameToUri(source.fileName));
									if (casing.tag === TagNameCasing.Kebab) {
										for (const item of result.items) {
											item.filterText = hyphenate(item.filterText ?? item.label);
										}
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
						&& item.textEdit?.newText.endsWith(suffix)
						&& item.additionalTextEdits?.length === 1 && item.additionalTextEdits[0].newText.indexOf('import ' + item.textEdit.newText + ' from ') >= 0
						&& (await _context.env.getConfiguration?.<boolean>('vue.complete.normalizeComponentImportName') ?? true)
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
							const casing = await getNameCasing(ts, _context, _context.env.fileNameToUri(source.fileName));
							if (casing.tag === TagNameCasing.Kebab) {
								item.textEdit.newText = hyphenate(item.textEdit.newText);
							}
						}
					}
					else if (item.textEdit?.newText && new RegExp(`import \\w*${suffix}\\$1 from [\\S\\s]*`).test(item.textEdit.newText)) {
						// https://github.com/vuejs/language-tools/issues/2286
						item.textEdit.newText = item.textEdit.newText.replace(`${suffix}$1`, '$1');
					}
				}

				const data: Data = item.data;
				if (item.data?.__isComponentAutoImport && data && item.additionalTextEdits?.length && item.textEdit) {
					let transformed = false;
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
										const editRange: vscode.Range = {
											start: textDoc.positionAt(sfc.script.startTagEnd + exportDefault.componentsOption.start),
											end: textDoc.positionAt(sfc.script.startTagEnd + exportDefault.componentsOption.end),
										};
										transformed = true;
										item.additionalTextEdits.push({
											range: editRange,
											newText: unescape(printText.replace(/\\u/g, '%u')),
										});
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
										const editRange: vscode.Range = {
											start: textDoc.positionAt(sfc.script.startTagEnd + exportDefault.args.start),
											end: textDoc.positionAt(sfc.script.startTagEnd + exportDefault.args.end),
										};
										transformed = true;
										item.additionalTextEdits.push({
											range: editRange,
											newText: unescape(printText.replace(/\\u/g, '%u')),
										});
									}
								}
							}
						}
					}
					if (transformed) {
						transformedItem.add(item);
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
						if ('textDocument' in documentChange) {
							patchAdditionalTextEdits(documentChange.textDocument.uri, documentChange.edits);
						}
					}
				}

				return result;
			},
		};
	};
	services.html ??= createVueTemplateLanguageService({
		baseService: createHtmlService(),
		getScanner: (htmlService, document): html.Scanner | undefined => {
			return htmlService.provide['html/languageService']().createScanner(document.getText());
		},
		updateCustomData(htmlService, extraData) {
			htmlService.provide['html/updateCustomData'](extraData);
		},
		isSupportedDocument: (document) => document.languageId === 'html',
		vueCompilerOptions,
	});
	services.pug ??= createVueTemplateLanguageService({
		baseService: createPugService(),
		getScanner: (pugService, document): html.Scanner | undefined => {
			const pugDocument = pugService.provide['pug/pugDocument'](document);
			if (pugDocument) {
				return pugService.provide['pug/languageService']().createScanner(pugDocument);
			}
		},
		updateCustomData(pugService, extraData) {
			pugService.provide['pug/updateCustomData'](extraData);
		},
		isSupportedDocument: (document) => document.languageId === 'jade',
		vueCompilerOptions,
	});
	services.vue ??= createVueService();
	services.css ??= createCssService();
	services['pug-beautify'] ??= createPugFormatService();
	services.json ??= createJsonService(settings?.json);
	services['typescript/twoslash-queries'] ??= createTsTqService();
	services['vue/referencesCodeLens'] ??= createReferencesCodeLensService();
	services['vue/autoInsertDotValue'] ??= createAutoDotValueService();
	services['vue/twoslash-queries'] ??= createVueTqService();
	services['vue/autoInsertParentheses'] ??= createAutoWrapParenthesesService();
	services['vue/autoInsertSpaces'] ??= createAutoAddSpaceService();
	services['vue/visualizeHiddenCallbackParam'] ??= createVisualizeHiddenCallbackParamService();
	services.emmet ??= createEmmetService();

	return services;
}

// fix https://github.com/vuejs/language-tools/issues/916
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
