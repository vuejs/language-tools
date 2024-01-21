import { ServiceEnvironment, ServicePlugin } from '@volar/language-service';
import { LanguagePlugin, VueGeneratedCode, createLanguages, hyphenateTag, scriptRanges } from '@vue/language-core';
import { capitalize } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { Data } from 'volar-service-typescript/lib/features/completions/basic';
import type * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver-protocol';
import { getNameCasing } from './ideFeatures/nameCasing';
import { TagNameCasing, VueCompilerOptions } from './types';

// volar services
import { create as createCssService } from 'volar-service-css';
import { create as createEmmetService } from 'volar-service-emmet';
import { create as createHtmlService } from 'volar-service-html';
import { create as createJsonService } from 'volar-service-json';
import { create as createPugService } from 'volar-service-pug';
import { create as createPugFormatService } from 'volar-service-pug-beautify';
import { create as createTsService, Provide as TSProvide } from 'volar-service-typescript';
import { create as createTsTqService } from 'volar-service-typescript-twoslash-queries';

// our services
import { create as createVueService } from './plugins/vue';
import { create as createDocumentDropService } from './plugins/vue-document-drop';
import { create as createAutoDotValueService } from './plugins/vue-autoinsert-dotvalue';
import { create as createAutoWrapParenthesesService } from './plugins/vue-autoinsert-parentheses';
import { create as createAutoAddSpaceService } from './plugins/vue-autoinsert-space';
import { create as createReferencesCodeLensService } from './plugins/vue-codelens-references';
import { create as createDirectiveCommentsService } from './plugins/vue-directive-comments';
import { create as createVueExtractFileService, createAddComponentToOptionEdit } from './plugins/vue-extract-file';
import { create as createVueTemplateLanguageService } from './plugins/vue-template';
import { create as createToggleVBindService } from './plugins/vue-toggle-v-bind-codeaction';
import { create as createVueTqService } from './plugins/vue-twoslash-queries';
import { create as createVisualizeHiddenCallbackParamService } from './plugins/vue-visualize-hidden-callback-param';

export interface Settings {
	json?: Parameters<typeof createJsonService>[0];
}

export function resolveLanguages(
	languages: Record<string, LanguagePlugin>,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getFileName: (fileId: string) => string,
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	codegenStack: boolean = false,
): Record<string, LanguagePlugin> {

	const vueLanguageModules = createLanguages(ts, getFileName, compilerOptions, vueCompilerOptions, codegenStack);

	return {
		...languages,
		...vueLanguageModules.reduce((obj, module, i) => {
			obj['vue_' + i] = module;
			return obj;
		}, {} as Record<string, LanguagePlugin>),
	};
}

export function resolveServices(
	services: Record<string, ServicePlugin>,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getVueOptions: (env: ServiceEnvironment) => VueCompilerOptions,
) {

	const tsService: ServicePlugin = services?.typescript ?? createTsService(ts);

	services ??= {};
	services.typescript = {
		...tsService,
		create(context) {
			const base = tsService.create(context);
			return {
				...base,
				async provideCompletionItems(document, position, completeContext, item) {
					const result = await base.provideCompletionItems?.(document, position, completeContext, item);
					if (result) {

						// filter __VLS_
						result.items = result.items.filter(item =>
							item.label.indexOf('__VLS_') === -1
							&& (!item.labelDetails?.description || item.labelDetails.description.indexOf('__VLS_') === -1)
						);

						// handle component auto-import patch
						let casing: Awaited<ReturnType<typeof getNameCasing>> | undefined;

						const [virtualCode, sourceFile] = context.documents.getVirtualCodeByUri(document.uri);

						if (virtualCode && sourceFile) {

							for (const map of context.documents.getMaps(virtualCode)) {

								const sourceVirtualFile = context.files.get(map.sourceFileDocument.uri)?.generated?.code;

								if (sourceVirtualFile instanceof VueGeneratedCode) {

									const isAutoImport = !!map.getSourcePosition(position, data => typeof data.completion === 'object' && !!data.completion.onlyImport);
									if (isAutoImport) {

										for (const item of result.items) {
											item.data.__isComponentAutoImport = true;
										}

										// fix #2458
										casing ??= await getNameCasing(ts, context, sourceFile.id, getVueOptions(context.env));

										if (casing.tag === TagNameCasing.Kebab) {
											for (const item of result.items) {
												item.filterText = hyphenateTag(item.filterText ?? item.label);
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

					for (const ext of getVueOptions(context.env).extensions) {
						const suffix = capitalize(ext.substring('.'.length)); // .vue -> Vue
						if (
							itemData?.uri
							&& item.textEdit?.newText.endsWith(suffix)
							&& item.additionalTextEdits?.length === 1 && item.additionalTextEdits[0].newText.indexOf('import ' + item.textEdit.newText + ' from ') >= 0
							&& (await context.env.getConfiguration?.<boolean>('vue.complete.normalizeComponentImportName') ?? true)
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
							const [_, sourceFile] = context.documents.getVirtualCodeByUri(itemData.uri);
							if (sourceFile) {
								const casing = await getNameCasing(ts, context, sourceFile.id, getVueOptions(context.env));
								if (casing.tag === TagNameCasing.Kebab) {
									item.textEdit.newText = hyphenateTag(item.textEdit.newText);
								}
							}
						}
						else if (item.textEdit?.newText && new RegExp(`import \\w*${suffix}\\$1 from [\\S\\s]*`).test(item.textEdit.newText)) {
							// https://github.com/vuejs/language-tools/issues/2286
							item.textEdit.newText = item.textEdit.newText.replace(`${suffix}$1`, '$1');
						}
					}

					const data: Data = item.data;
					if (item.data?.__isComponentAutoImport && data && item.additionalTextEdits?.length && item.textEdit && itemData?.uri) {
						const langaugeService = context.inject<TSProvide, 'typescript/languageService'>('typescript/languageService');
						const [virtualCode] = context.documents.getVirtualCodeByUri(itemData.uri);
						const ast = langaugeService.getProgram()?.getSourceFile(itemData.uri);
						const exportDefault = ast ? scriptRanges.parseScriptRanges(ts, ast, false, true).exportDefault : undefined;
						if (virtualCode && ast && exportDefault) {
							const componentName = newName ?? item.textEdit.newText;
							const optionEdit = createAddComponentToOptionEdit(ts, ast, componentName);
							if (optionEdit) {
								const textDoc = context.documents.get(context.documents.getVirtualCodeUri(context.files.getByVirtualCode(virtualCode).id, virtualCode.id), virtualCode.languageId, virtualCode.snapshot);
								item.additionalTextEdits.push({
									range: {
										start: textDoc.positionAt(optionEdit.range.start),
										end: textDoc.positionAt(optionEdit.range.end),
									},
									newText: optionEdit.newText,
								});
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
							if ('textDocument' in documentChange) {
								patchAdditionalTextEdits(documentChange.textDocument.uri, documentChange.edits);
							}
						}
					}

					return result;
				},
				async provideSemanticDiagnostics(document, token) {
					const result = await base.provideSemanticDiagnostics?.(document, token);
					return result?.map(diagnostic => {
						if (
							diagnostic.source === 'ts'
							&& diagnostic.code === 2578 /* Unused '@ts-expect-error' directive. */
							&& document.getText(diagnostic.range) === '// @ts-expect-error __VLS_TS_EXPECT_ERROR'
						) {
							diagnostic.source = 'vue';
							diagnostic.code = 'ts-2578';
							diagnostic.message = diagnostic.message.replace(/@ts-expect-error/g, '@vue-expect-error');
						}
						return diagnostic;
					});
				},
			};
		},
	};
	services.html ??= createVueTemplateLanguageService(
		ts,
		createHtmlService(),
		getVueOptions,
		{
			getScanner: (htmlService, document): html.Scanner | undefined => {
				return htmlService.provide['html/languageService']().createScanner(document.getText());
			},
			updateCustomData(htmlService, extraData) {
				htmlService.provide['html/updateCustomData'](extraData);
			},
			isSupportedDocument: (document) => document.languageId === 'html',
		}
	);
	services.pug ??= createVueTemplateLanguageService(
		ts,
		createPugService(),
		getVueOptions,
		{
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
		}
	);
	services.vue ??= createVueService();
	services.css ??= createCssService();
	services['pug-beautify'] ??= createPugFormatService();
	services.json ??= createJsonService();
	services['typescript/twoslash-queries'] ??= createTsTqService();
	services['vue/referencesCodeLens'] ??= createReferencesCodeLensService();
	services['vue/documentDrop'] ??= createDocumentDropService(ts);
	services['vue/autoInsertDotValue'] ??= createAutoDotValueService(ts);
	services['vue/twoslash-queries'] ??= createVueTqService(ts);
	services['vue/autoInsertParentheses'] ??= createAutoWrapParenthesesService(ts);
	services['vue/autoInsertSpaces'] ??= createAutoAddSpaceService();
	services['vue/visualizeHiddenCallbackParam'] ??= createVisualizeHiddenCallbackParamService();
	services['vue/directiveComments'] ??= createDirectiveCommentsService();
	services['vue/extractComponent'] ??= createVueExtractFileService(ts);
	services['vue/toggleVBind'] ??= createToggleVBindService(ts);
	services.emmet ??= createEmmetService();

	services.html.name += ' (html)';
	services.pug.name += ' (pug)';

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
