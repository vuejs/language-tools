import useCssPlugin from '@volar-plugins/css';
import useEmmetPlugin from '@volar-plugins/emmet';
import useHtmlPlugin from '@volar-plugins/html';
import useJsonPlugin from '@volar-plugins/json';
import usePugPlugin from '@volar-plugins/pug';
import useTsPlugin from '@volar-plugins/typescript';
import useTsTqPlugin from '@volar-plugins/typescript-twoslash-queries';
import * as embedded from '@volar/language-core';
import * as embeddedLS from '@volar/language-service';
import * as vue from '@volar/vue-language-core';
import { LanguageServiceHost } from '@volar/vue-language-core';
import type * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import useVuePlugin from './plugins/vue';
import useAutoDotValuePlugin from './plugins/vue-autoinsert-dotvalue';
import useReferencesCodeLensPlugin from './plugins/vue-codelens-references';
import useHtmlPugConversionsPlugin from './plugins/vue-convert-htmlpug';
import useRefSugarConversionsPlugin from './plugins/vue-convert-refsugar';
import useScriptSetupConversionsPlugin from './plugins/vue-convert-scriptsetup';
import useTwoslashQueries from './plugins/vue-twoslash-queries';
import useVueTemplateLanguagePlugin from './plugins/vue-template';
import type { Data } from '@volar-plugins/typescript/src/services/completions/basic';
import type * as ts from 'typescript/lib/tsserverlibrary';

export interface Settings {
	json?: Parameters<typeof useJsonPlugin>[0];
}

export function getLanguageServicePlugins(
	host: vue.LanguageServiceHost,
	apis: embeddedLS.LanguageService,
	settings?: Settings,
): embeddedLS.LanguageServicePlugin[] {

	// plugins
	const _tsPlugin = useTsPlugin();
	const tsPlugin: embeddedLS.LanguageServicePlugin = (() => {
		let context: embeddedLS.LanguageServicePluginContext;
		const autoImportPositions = new WeakSet<vscode.Position>();
		return {
			..._tsPlugin,
			setup(_context) {
				_tsPlugin.setup?.(_context);
				context = _context;
			},
			resolveEmbeddedRange(range) {
				if (autoImportPositions.has(range.start) && autoImportPositions.has(range.end))
					return range;
			},
			complete: {
				..._tsPlugin.complete,
				async on(document, position, context) {
					const result = await _tsPlugin.complete!.on!(document, position, context);
					if (result) {
						const map = apis.context.documents.getMap(document.uri);
						const doc = map ? apis.context.documents.get(map.sourceDocument.uri) : undefined;
						if (map && doc?.file instanceof vue.VueFile) {
							if (map.toSourcePosition(position, data => typeof data.completion === 'object' && !!data.completion.autoImportOnly)) {
								result.items.forEach(item => {
									item.data.__isComponentAutoImport = true;
								});
							}
						}
					}
					return result;
				},
				async resolve(item) {
					item = await _tsPlugin.complete!.resolve!(item);

					if (
						item.textEdit?.newText && /\w*Vue$/.test(item.textEdit.newText)
						&& item.additionalTextEdits?.length === 1 && item.additionalTextEdits[0].newText.indexOf('import ' + item.textEdit.newText + ' from ') >= 0
						&& (await context.env.configurationHost?.getConfiguration<boolean>('volar.completion.normalizeComponentAutoImportName') ?? true)
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
						const map = apis.context.documents.getMap(data.uri);
						const doc = map ? apis.context.documents.get(map.sourceDocument.uri) : undefined;
						if (map && doc?.file instanceof vue.VueFile) {
							const sfc = doc.file.sfc;
							const componentName = item.textEdit.newText;
							const textDoc = doc.document;
							if (sfc.scriptAst && sfc.script) {
								const ts = context.typescript.module;
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

					return item;
				},
			},
		};
	})();
	const vuePlugin = useVuePlugin({
		getVueDocument: (document) => apis.context.documents.get(document.uri),
	});
	const cssPlugin = useCssPlugin();
	const jsonPlugin = useJsonPlugin(settings?.json);
	const emmetPlugin = useEmmetPlugin();
	const autoDotValuePlugin = useAutoDotValuePlugin();
	const referencesCodeLensPlugin = useReferencesCodeLensPlugin({
		getVueDocument: (uri) => apis.context.documents.get(uri),
		findReference: apis.findReferences,
	});
	const htmlPugConversionsPlugin = useHtmlPugConversionsPlugin({
		getVueDocument: (uri) => apis.context.documents.get(uri),
	});
	const scriptSetupConversionsPlugin = useScriptSetupConversionsPlugin({
		getVueDocument: (uri) => apis.context.documents.get(uri),
		doCodeActions: apis.doCodeActions,
		doCodeActionResolve: apis.doCodeActionResolve,
	});
	const refSugarConversionsPlugin = useRefSugarConversionsPlugin({
		getVueDocument: (uri) => apis.context.documents.get(uri),
		doCodeActions: apis.doCodeActions,
		doCodeActionResolve: apis.doCodeActionResolve,
		findReferences: apis.findReferences,
		doValidation: apis.doValidation,
		doRename: apis.doRename,
		findTypeDefinition: apis.findTypeDefinition,
	});

	// template plugins
	const _htmlPlugin = useHtmlPlugin();
	const _pugPlugin = usePugPlugin();
	const htmlPlugin = useVueTemplateLanguagePlugin({
		templateLanguagePlugin: _htmlPlugin,
		getScanner: (document): html.Scanner | undefined => {
			return _htmlPlugin.getHtmlLs().createScanner(document.getText());
		},
		isSupportedDocument: (document) => document.languageId === 'html',
		vueLsHost: host,
		context: apis.context,
	});
	const pugPlugin = useVueTemplateLanguagePlugin({
		templateLanguagePlugin: _pugPlugin,
		getScanner: (document): html.Scanner | undefined => {
			const pugDocument = _pugPlugin.getPugDocument(document);
			if (pugDocument) {
				return _pugPlugin.getPugLs().createScanner(pugDocument);
			}
		},
		isSupportedDocument: (document) => document.languageId === 'jade',
		vueLsHost: host,
		context: apis.context,
	});
	const tsTwoslashQueriesPlugin = useTsTqPlugin();
	const vueTwoslashQueriesPlugin = useTwoslashQueries({
		getVueDocument: (document) => apis.context.documents.get(document.uri),
	});

	return [
		vuePlugin,
		cssPlugin,
		htmlPlugin,
		pugPlugin,
		jsonPlugin,
		referencesCodeLensPlugin,
		htmlPugConversionsPlugin,
		scriptSetupConversionsPlugin,
		refSugarConversionsPlugin,
		tsPlugin,
		autoDotValuePlugin,
		tsTwoslashQueriesPlugin,
		vueTwoslashQueriesPlugin,
		// put emmet plugin at last to fix https://github.com/johnsoncodehk/volar/issues/1088
		emmetPlugin,
	];
}

export function createLanguageService(
	host: LanguageServiceHost,
	env: embeddedLS.LanguageServicePluginContext['env'],
	documentRegistry?: ts.DocumentRegistry,
	settings?: Settings,
) {

	const vueLanguageModule = vue.createLanguageModule(
		host.getTypeScriptModule(),
		host.getCurrentDirectory(),
		host.getCompilationSettings(),
		host.getVueCompilationSettings(),
	);
	const core = embedded.createEmbeddedLanguageServiceHost(host, [vueLanguageModule]);
	const languageServiceContext = embeddedLS.createLanguageServiceContext({
		env,
		host,
		context: core,
		getPlugins() {
			return getLanguageServicePlugins(host, languageService, settings);
		},
		documentRegistry,
	});
	const languageService = embeddedLS.createLanguageService(languageServiceContext);

	return languageService;
}
