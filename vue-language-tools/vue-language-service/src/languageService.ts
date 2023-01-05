import createCssPlugin from '@volar-plugins/css';
import createEmmetPlugin from '@volar-plugins/emmet';
import createHtmlPlugin from '@volar-plugins/html';
import createJsonPlugin from '@volar-plugins/json';
import createPugPlugin from '@volar-plugins/pug';
import createTsPlugin from '@volar-plugins/typescript';
import createTsTqPlugin from '@volar-plugins/typescript-twoslash-queries';
import * as embedded from '@volar/language-core';
import * as embeddedLS from '@volar/language-service';
import * as vue from '@volar/vue-language-core';
import { VueLanguageServiceHost } from '@volar/vue-language-core';
import type * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import createVuePlugin from './plugins/vue';
import createAutoDotValuePlugin from './plugins/vue-autoinsert-dotvalue';
import createReferencesCodeLensPlugin from './plugins/vue-codelens-references';
import createHtmlPugConversionsPlugin from './plugins/vue-convert-htmlpug';
import createRefSugarConversionsPlugin from './plugins/vue-convert-refsugar';
import createScriptSetupConversionsPlugin from './plugins/vue-convert-scriptsetup';
import createTwoslashQueries from './plugins/vue-twoslash-queries';
import createVueTemplateLanguagePlugin from './plugins/vue-template';
import type { Data } from '@volar-plugins/typescript/src/services/completions/basic';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { LanguageServicePlugin } from '@volar/language-service';

import createPugFormatPlugin from '@volar-plugins/pug-beautify';
import createAutoWrapParenthesesPlugin from './plugins/vue-autoinsert-parentheses';
import createAutoAddSpacePlugin from './plugins/vue-autoinsert-space';
import { VueCompilerOptions } from './types';

export interface Settings {
	json?: Parameters<typeof createJsonPlugin>[0];
}

export function getLanguageServicePlugins(vueCompilerOptions: VueCompilerOptions, settings?: Settings) {

	const tsPlugin = createTsPlugin();
	const tsPluginPatchAutoImport: embeddedLS.LanguageServicePlugin = (_context, service) => {

		if (!_context.typescript)
			return {};

		const ts = _context.typescript.module;
		const base = tsPlugin(_context, service);
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
					const result = await base.complete!.on!(document, position, context);
					if (result) {
						for (const [_, map] of _context.documents.getMapsByVirtualFileUri(document.uri)) {
							const virtualFile = _context.documents.getRootFileBySourceFileUri(map.sourceFileDocument.uri);
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

					if (
						item.textEdit?.newText && /\w*Vue$/.test(item.textEdit.newText)
						&& item.additionalTextEdits?.length === 1 && item.additionalTextEdits[0].newText.indexOf('import ' + item.textEdit.newText + ' from ') >= 0
						&& (await _context.env.configurationHost?.getConfiguration<boolean>('volar.completion.normalizeComponentAutoImportName') ?? true)
					) {
						let newName = item.textEdit.newText.slice(0, -'Vue'.length);
						newName = newName[0].toUpperCase() + newName.substring(1);
						item.additionalTextEdits[0].newText = item.additionalTextEdits[0].newText.replace(
							'import ' + item.textEdit.newText + ' from ',
							'import ' + newName + ' from ',
						);
						item.textEdit.newText = newName;
					}

					const data: Data = item.data;
					if (item.data?.__isComponentAutoImport && data && item.additionalTextEdits?.length && item.textEdit) {
						for (const [_, map] of _context.documents.getMapsByVirtualFileUri(data.uri)) {
							const virtualFile = _context.documents.getRootFileBySourceFileUri(map.sourceFileDocument.uri);
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
		templateLanguagePlugin: createPugPlugin(),
		getScanner: (document, pugPlugin): html.Scanner | undefined => {
			const pugDocument = pugPlugin.getPugDocument(document);
			if (pugDocument) {
				return pugPlugin.getPugLs().createScanner(pugDocument);
			}
		},
		isSupportedDocument: (document) => document.languageId === 'jade',
		vueCompilerOptions,
	});

	return [
		createVuePlugin(vueCompilerOptions),
		createCssPlugin(),
		htmlPlugin,
		pugPlugin,
		createJsonPlugin(settings?.json),
		createReferencesCodeLensPlugin(),
		createHtmlPugConversionsPlugin(),
		createScriptSetupConversionsPlugin(vueCompilerOptions),
		createRefSugarConversionsPlugin(),
		tsPluginPatchAutoImport,
		createAutoDotValuePlugin(),
		createTsTqPlugin(),
		createTwoslashQueries(),
		createPugFormatPlugin(),
		createAutoWrapParenthesesPlugin(),
		createAutoAddSpacePlugin(),
		// put emmet plugin at last to fix https://github.com/johnsoncodehk/volar/issues/1088
		createEmmetPlugin(),
	] as LanguageServicePlugin[];
}

export function createLanguageService(
	host: VueLanguageServiceHost,
	env: embeddedLS.LanguageServiceRuntimeContext['env'],
	documentRegistry?: ts.DocumentRegistry,
	settings?: Settings,
) {

	const ts = host.getTypeScriptModule();
	const vueCompilerOptions = vue.resolveVueCompilerOptions(host.getVueCompilationSettings());
	const vueLanguageModules = ts ? vue.createLanguageModules(
		ts,
		host.getCompilationSettings(),
		vueCompilerOptions,
	) : [];
	const core = embedded.createLanguageContext(host, vueLanguageModules);
	const languageServiceContext = embeddedLS.createLanguageServiceContext({
		env,
		host,
		context: core,
		documentRegistry,
		getPlugins: () => getLanguageServicePlugins(vueCompilerOptions, settings),
		getLanguageService: () => languageService,
	});
	const languageService = embeddedLS.createLanguageService(languageServiceContext);

	return languageService;
}
