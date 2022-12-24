import { transformCompletionList } from '@volar/transforms';
import type { LanguageServicePlugin, PositionCapabilities } from '@volar/language-service';
import * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceRuntimeContext } from '../types';
import { visitEmbedded } from '../utils/definePlugin';

export interface PluginCompletionData {
	uri: string,
	originalItem: vscode.CompletionItem,
	pluginId: number,
	map: {
		embeddedDocumentUri: string;
	} | undefined,
}

export function register(context: LanguageServiceRuntimeContext) {

	let cache: {
		uri: string,
		data: {
			map: {
				embeddedDocumentUri: string;
			} | undefined,
			plugin: LanguageServicePlugin,
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

				if (cacheData.map) {

					for (const [_, map] of context.documents.getMapsByVirtualFileUri(cacheData.map.embeddedDocumentUri)) {

						for (const mapped of map.toGeneratedPositions(position, data => !!data.completion)) {

							if (!cacheData.plugin.complete?.on)
								continue;

							const embeddedCompletionList = await cacheData.plugin.complete.on(map.mappedDocument, mapped, completionContext);

							if (!embeddedCompletionList) {
								cacheData.list.isIncomplete = false;
								continue;
							}

							cacheData.list = transformCompletionList(
								embeddedCompletionList,
								range => map.toSourceRange(range),
								(newItem, oldItem) => newItem.data = {
									uri,
									originalItem: oldItem,
									pluginId: context.plugins.indexOf(cacheData.plugin),
									map: {
										embeddedDocumentUri: map.mappedDocument.uri,
									},
								} satisfies PluginCompletionData,
							);
						}
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
						items: completionList.items.map<vscode.CompletionItem>(item => ({
							...item,
							data: {
								uri,
								originalItem: item,
								pluginId: context.plugins.indexOf(cacheData.plugin),
								map: undefined,
							} satisfies PluginCompletionData,
						})),
					};
				}
			}
		}
		else {

			const rootFile = context.documents.getRootFile(uri);

			cache = {
				uri,
				data: [],
				mainCompletion: undefined,
			};

			// monky fix https://github.com/johnsoncodehk/volar/issues/1358
			let isFirstMapping = true;

			if (rootFile) {

				await visitEmbedded(context.documents, rootFile, async (_, map) => {

					const plugins = context.plugins.sort(sortPlugins);

					let _data: PositionCapabilities | undefined;

					for (const mapped of map.toGeneratedPositions(position, data => {
						_data = data;
						return !!data.completion;
					})) {

						for (const plugin of plugins) {

							if (!plugin.complete?.on)
								continue;

							if (plugin.complete.isAdditional && !isFirstMapping)
								continue;

							if (completionContext?.triggerCharacter && !plugin.complete.triggerCharacters?.includes(completionContext.triggerCharacter))
								continue;

							const isAdditional = _data && typeof _data.completion === 'object' && _data.completion.additional || plugin.complete.isAdditional;

							if (cache!.mainCompletion && (!isAdditional || cache?.mainCompletion.documentUri !== map.mappedDocument.uri))
								continue;

							// avoid duplicate items with .vue and .vue.html
							if (plugin.complete.isAdditional && cache?.data.some(data => data.plugin === plugin))
								continue;

							const embeddedCompletionList = await plugin.complete.on(map.mappedDocument, mapped, completionContext);

							if (!embeddedCompletionList || !embeddedCompletionList.items.length)
								continue;

							if (typeof _data?.completion === 'object' && _data.completion.autoImportOnly) {
								embeddedCompletionList.items = embeddedCompletionList.items.filter(item => !!item.labelDetails);
							}

							if (!isAdditional) {
								cache!.mainCompletion = { documentUri: map.mappedDocument.uri };
							}

							const completionList = transformCompletionList(
								embeddedCompletionList,
								range => map.toSourceRange(range),
								(newItem, oldItem) => newItem.data = {
									uri,
									originalItem: oldItem,
									pluginId: context.plugins.indexOf(plugin),
									map: {
										embeddedDocumentUri: map.mappedDocument.uri,
									}
								} satisfies PluginCompletionData,
							);

							cache!.data.push({
								map: {
									embeddedDocumentUri: map.mappedDocument.uri,
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
						map: undefined,
						plugin,
						list: {
							...completionList,
							items: completionList.items.map<vscode.CompletionItem>(item => {
								return {
									...item,
									data: {
										uri,
										originalItem: item,
										pluginId: context.plugins.indexOf(plugin),
										sourceMap: undefined,
									},
								};
							})
						},
					});
				}
			}
		}

		return combineCompletionList(cache.data.map(cacheData => cacheData.list));

		function sortPlugins(a: LanguageServicePlugin, b: LanguageServicePlugin) {
			return (b.complete?.isAdditional ? -1 : 1) - (a.complete?.isAdditional ? -1 : 1);
		}

		function combineCompletionList(lists: vscode.CompletionList[]): vscode.CompletionList {
			return {
				isIncomplete: lists.some(list => list.isIncomplete),
				itemDefaults: lists.find(list => list.itemDefaults)?.itemDefaults,
				items: lists.map(list => list.items).flat().filter((result: vscode.CompletionItem) =>
					result.label.indexOf('__VLS_') === -1
					&& (!result.labelDetails?.description || result.labelDetails.description.indexOf('__VLS_') === -1)
				),
			};
		}
	};
}
