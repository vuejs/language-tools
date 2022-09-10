import { transformCompletionItem } from '@volar/transforms';
import type { EmbeddedLanguageServicePlugin } from '@volar/language-service';
import * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceRuntimeContext } from '../types';
import { visitEmbedded } from '../utils/definePlugin';

export interface PluginCompletionData {
	uri: string,
	originalItem: vscode.CompletionItem,
	pluginId: number,
	sourceMap: {
		embeddedDocumentUri: string;
	} | undefined,
}

export function register(context: LanguageServiceRuntimeContext) {

	let cache: {
		uri: string,
		data: {
			sourceMap: {
				embeddedDocumentUri: string;
			} | undefined,
			plugin: EmbeddedLanguageServicePlugin,
			list: vscode.CompletionList,
		}[],
		mainCompletion: {
			documentUri: string,
		} | undefined,
	} | undefined;

	return async (uri: string, position: vscode.Position, completionContext?: vscode.CompletionContext) => {

		let document: TextDocument | undefined;

		if (
			completionContext?.triggerKind === vscode.CompletionTriggerKind.TriggerForIncompleteCompletions
			&& cache?.uri === uri
		) {

			for (const cacheData of cache.data) {

				if (!cacheData.list.isIncomplete)
					continue;

				if (cacheData.sourceMap) {

					const sourceMap = context.documents.sourceMapFromEmbeddedDocumentUri(cacheData.sourceMap.embeddedDocumentUri);

					if (!sourceMap)
						continue;

					for (const [embeddedRange] of sourceMap.getMappedRanges(position, position, data => !!data.capabilities.completion)) {

						if (!cacheData.plugin.complete?.on)
							continue;

						const embeddedCompletionList = await cacheData.plugin.complete.on(sourceMap.mappedDocument, embeddedRange.start, completionContext);

						if (!embeddedCompletionList) {
							cacheData.list.isIncomplete = false;
							continue;
						}

						cacheData.list = {
							...embeddedCompletionList,
							items: embeddedCompletionList.items.map(item => {
								const data: PluginCompletionData = {
									uri,
									originalItem: item,
									pluginId: context.plugins.indexOf(cacheData.plugin),
									sourceMap: {
										embeddedDocumentUri: sourceMap.mappedDocument.uri,
									},
								};
								return {
									...transformCompletionItem(
										item,
										embeddedRange => sourceMap.getSourceRange(embeddedRange.start, embeddedRange.end)?.[0],
									),
									data: data,
								};
							}),
						};
					}
				}
				else if (document = context.getTextDocument(uri)) {

					if (!cacheData.plugin.complete?.on)
						continue;

					const completionList = await cacheData.plugin.complete.on(document, position, completionContext);

					if (!completionList) {
						cacheData.list.isIncomplete = false;
						continue;
					}

					cacheData.list = {
						...completionList,
						items: completionList.items.map(item => {
							const data: PluginCompletionData = {
								uri,
								originalItem: item,
								pluginId: context.plugins.indexOf(cacheData.plugin),
								sourceMap: undefined,
							};
							return {
								...item,
								data: data,
							};
						})
					};
				}
			}
		}
		else {

			const vueDocument = context.documents.get(uri);

			cache = {
				uri,
				data: [],
				mainCompletion: undefined,
			};

			// monky fix https://github.com/johnsoncodehk/volar/issues/1358
			let isFirstMapping = true;

			if (vueDocument) {

				await visitEmbedded(vueDocument, async sourceMap => {

					const plugins = context.plugins.sort(sortPlugins);

					for (const [embeddedRange, data] of sourceMap.getMappedRanges(position, position, data => !!data.capabilities.completion)) {

						for (const plugin of plugins) {

							if (!plugin.complete?.on)
								continue;

							if (plugin.complete.isAdditional && !isFirstMapping)
								continue;

							if (completionContext?.triggerCharacter && !plugin.complete.triggerCharacters?.includes(completionContext.triggerCharacter))
								continue;

							const isAdditionalMapping = typeof data.capabilities.completion === 'object' && data.capabilities.completion.additional;
							if (cache!.mainCompletion && ((!plugin.complete.isAdditional && !isAdditionalMapping) || cache?.mainCompletion.documentUri !== sourceMap.mappedDocument.uri))
								continue;

							// avoid duplicate items with .vue and .vue.html
							if (plugin.complete.isAdditional && cache?.data.some(data => data.plugin === plugin))
								continue;

							const embeddedCompletionList = await plugin.complete.on(sourceMap.mappedDocument, embeddedRange.start, completionContext);

							if (!embeddedCompletionList || !embeddedCompletionList.items.length)
								continue;

							if (!plugin.complete.isAdditional) {
								cache!.mainCompletion = { documentUri: sourceMap.mappedDocument.uri };
							}

							const completionList: vscode.CompletionList = {
								...embeddedCompletionList,
								items: embeddedCompletionList.items.map(item => {
									const data: PluginCompletionData = {
										uri,
										originalItem: item,
										pluginId: context.plugins.indexOf(plugin),
										sourceMap: {
											embeddedDocumentUri: sourceMap.mappedDocument.uri,
										}
									};
									return {
										...transformCompletionItem(
											item,
											embeddedRange => sourceMap.getSourceRange(embeddedRange.start, embeddedRange.end)?.[0],
										),
										data: data,
									};
								}),
							};

							cache!.data.push({
								sourceMap: {
									embeddedDocumentUri: sourceMap.mappedDocument.uri,
								},
								plugin,
								list: completionList,
							});
						}

						isFirstMapping = false;
					}

					return true;
				});
			}

			if (document = context.getTextDocument(uri)) {

				const plugins = context.plugins.sort(sortPlugins);

				for (const plugin of plugins) {

					if (!plugin.complete?.on)
						continue;

					if (plugin.complete.isAdditional && !isFirstMapping)
						continue;

					if (completionContext?.triggerCharacter && !plugin.complete.triggerCharacters?.includes(completionContext.triggerCharacter))
						continue;

					if (cache.mainCompletion && (!plugin.complete.isAdditional || cache.mainCompletion.documentUri !== document.uri))
						continue;

					// avoid duplicate items with .vue and .vue.html
					if (plugin.complete.isAdditional && cache?.data.some(data => data.plugin === plugin))
						continue;

					const completionList = await plugin.complete.on(document, position, completionContext);

					if (!completionList || !completionList.items.length)
						continue;

					if (!plugin.complete.isAdditional) {
						cache.mainCompletion = { documentUri: document.uri };
					}

					cache.data.push({
						sourceMap: undefined,
						plugin,
						list: {
							...completionList,
							items: completionList.items.map(item => {
								const data: PluginCompletionData = {
									uri,
									originalItem: item,
									pluginId: context.plugins.indexOf(plugin),
									sourceMap: undefined,
								};
								return {
									...item,
									data: data,
								};
							})
						},
					});
				}
			}
		}

		return combineCompletionList(cache.data.map(cacheData => cacheData.list));

		function sortPlugins(a: EmbeddedLanguageServicePlugin, b: EmbeddedLanguageServicePlugin) {
			return (b.complete?.isAdditional ? -1 : 1) - (a.complete?.isAdditional ? -1 : 1);
		}

		function combineCompletionList(lists: vscode.CompletionList[]) {
			return {
				isIncomplete: lists.some(list => list.isIncomplete),
				items: lists.map(list => list.items).flat().filter((result: vscode.CompletionItem) =>
					result.label.indexOf('__VLS_') === -1
					&& (!result.labelDetails?.description || result.labelDetails.description.indexOf('__VLS_') === -1)
				),
			};
		}
	};
}
