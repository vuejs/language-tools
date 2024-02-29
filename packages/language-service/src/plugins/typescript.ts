import { ServiceEnvironment, ServicePlugin, ServicePluginInstance } from '@volar/language-service';
import { VueCompilerOptions, VueGeneratedCode, hyphenateTag, scriptRanges } from '@vue/language-core';
import { capitalize } from '@vue/shared';
import * as ts from 'typescript';
import { create as baseCreate } from 'volar-service-typescript';
import type { Data } from 'volar-service-typescript/lib/features/completions/basic';
import { getNameCasing } from '../ideFeatures/nameCasing';
import { TagNameCasing } from '../types';
import { createAddComponentToOptionEdit } from './vue-extract-file';

// TODO: migrate patchs to ts plugin

const asts = new WeakMap<ts.IScriptSnapshot, ts.SourceFile>();

export function getAst(fileName: string, snapshot: ts.IScriptSnapshot, scriptKind?: ts.ScriptKind) {
	let ast = asts.get(snapshot);
	if (!ast) {
		ast = ts.createSourceFile(fileName, snapshot.getText(0, snapshot.getLength()), ts.ScriptTarget.Latest, undefined, scriptKind);
		asts.set(snapshot, ast);
	}
	return ast;
}

export function create(
	ts: typeof import('typescript'),
	getVueOptions: (env: ServiceEnvironment) => VueCompilerOptions,
): ServicePlugin {

	const base = baseCreate(ts);

	return {
		...base,
		create(context): ServicePluginInstance {
			const baseInstance = base.create(context);
			return {
				...baseInstance,
				async provideCompletionItems(document, position, completeContext, item) {
					const result = await baseInstance.provideCompletionItems?.(document, position, completeContext, item);
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

								const sourceVirtualFile = context.language.files.get(map.sourceDocument.uri)?.generated?.code;

								if (sourceVirtualFile instanceof VueGeneratedCode) {

									const isAutoImport = !!map.getSourcePosition(position, data => typeof data.completion === 'object' && !!data.completion.onlyImport);
									if (isAutoImport) {

										for (const item of result.items) {
											item.data.__isComponentAutoImport = true;
										}

										// fix #2458
										casing ??= await getNameCasing(context, sourceFile.id);

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

					item = await baseInstance.resolveCompletionItem?.(item, token) ?? item;

					const itemData = item.data as { uri?: string; } | undefined;

					let newName: string | undefined;

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
								const casing = await getNameCasing(context, sourceFile.id);
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
						const [virtualCode, sourceFile] = context.documents.getVirtualCodeByUri(itemData.uri);
						if (virtualCode && (sourceFile.generated?.code instanceof VueGeneratedCode)) {
							const script = sourceFile.generated.languagePlugin.typescript?.getScript(sourceFile.generated.code);
							if (script) {
								const ast = getAst(sourceFile.generated.code.fileName, script.code.snapshot, script.scriptKind);
								const exportDefault = scriptRanges.parseScriptRanges(ts, ast, false, true).exportDefault;
								if (exportDefault) {
									const componentName = newName ?? item.textEdit.newText;
									const optionEdit = createAddComponentToOptionEdit(ts, ast, componentName);
									if (optionEdit) {
										const textDoc = context.documents.get(context.documents.getVirtualCodeUri(sourceFile.id, virtualCode.id), virtualCode.languageId, virtualCode.snapshot);
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
						}
					}

					return item;
				},
				async provideCodeActions(document, range, context, token) {
					const result = await baseInstance.provideCodeActions?.(document, range, context, token);
					return result?.filter(codeAction => codeAction.title.indexOf('__VLS_') === -1);
				},
				async provideSemanticDiagnostics(document, token) {
					const result = await baseInstance.provideSemanticDiagnostics?.(document, token);
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
}
