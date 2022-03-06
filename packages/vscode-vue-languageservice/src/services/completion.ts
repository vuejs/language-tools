import { transformCompletionItem } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { visitEmbedded } from '../plugins/definePlugin';
import { LanguageServicePlugin } from '../languageService';

export interface PluginCompletionData {
	uri: string,
	originalItem: vscode.CompletionItem,
	pluginId: number,
	sourceMapId: number | undefined,
	embeddedDocumentUri: string | undefined,
}

export function register(
	{ sourceFiles, getPlugins, getTextDocument }: LanguageServiceRuntimeContext,
) {

	let cache: {
		uri: string,
		data: {
			sourceMapId: number | undefined,
			embeddedDocumentUri: string | undefined,
			plugin: LanguageServicePlugin,
			list: vscode.CompletionList,
		}[],
		mainCompletion: {
			documentUri: string,
		} | undefined,
	} | undefined;

	return async (uri: string, position: vscode.Position, context?: vscode.CompletionContext) => {

		const document = getTextDocument(uri);

		if (
			context?.triggerKind === vscode.CompletionTriggerKind.TriggerForIncompleteCompletions
			&& cache?.uri === uri
		) {

			for (const cacheData of cache.data) {

				if (!cacheData.list.isIncomplete)
					continue;

				if (cacheData.sourceMapId !== undefined && cacheData.embeddedDocumentUri !== undefined) {

					const sourceMap = sourceFiles.getSourceMap(cacheData.sourceMapId, cacheData.embeddedDocumentUri);

					if (!sourceMap)
						continue;

					for (const [embeddedRange] of sourceMap.getMappedRanges(position, position, data => !!data.capabilities.completion)) {

						if (!cacheData.plugin.doComplete)
							continue;

						const embeddedCompletionList = await cacheData.plugin.doComplete(sourceMap.mappedDocument, embeddedRange.start, context);

						if (!embeddedCompletionList) {
							cacheData.list.isIncomplete = false;
							continue;
						}

						cacheData.list = {
							...embeddedCompletionList,
							items: embeddedCompletionList.items.map(item => ({
								...transformCompletionItem(
									item,
									embeddedRange => sourceMap.getSourceRange(embeddedRange.start, embeddedRange.end)?.[0],
								),
								data: <PluginCompletionData>{
									uri,
									originalItem: item,
									pluginId: cacheData.plugin.id,
									sourceMapId: sourceMap.id,
									embeddedDocumentUri: sourceMap.mappedDocument.uri,
								} as any,
							})),
						};
					}
				}

				if (document) {

					if (!cacheData.plugin.doComplete)
						continue;

					const completionList = await cacheData.plugin.doComplete(document, position, context);

					if (!completionList) {
						cacheData.list.isIncomplete = false;
						continue;
					}

					cacheData.list = {
						...completionList,
						items: completionList.items.map(item => ({
							...item,
							data: <PluginCompletionData>{
								uri,
								originalItem: item,
								pluginId: cacheData.plugin.id,
								sourceMapId: undefined,
								embeddedDocumentUri: undefined,
							} as any,
						}))
					};
				}
			}
		}
		else {

			const vueDocument = sourceFiles.get(uri);

			cache = {
				uri,
				data: [],
				mainCompletion: undefined,
			};

			if (vueDocument) {

				const embeddeds = vueDocument.getEmbeddeds();

				await visitEmbedded(embeddeds, async sourceMap => {

					const plugins = getPlugins(sourceMap.lsType);

					for (const [embeddedRange] of sourceMap.getMappedRanges(position, position, data => !!data.capabilities.completion)) {

						for (const plugin of plugins) {

							if (!plugin.doComplete)
								continue;

							if (context?.triggerCharacter && !plugin.context?.triggerCharacters?.includes(context.triggerCharacter))
								continue;

							if (cache!.mainCompletion && (!plugin.context?.isAdditionalCompletion || cache?.mainCompletion.documentUri !== sourceMap.mappedDocument.uri))
								continue;

							const embeddedCompletionList = await plugin.doComplete(sourceMap.mappedDocument, embeddedRange.start, context);

							if (!embeddedCompletionList)
								continue;

							if (!plugin.context?.isAdditionalCompletion) {
								cache!.mainCompletion = { documentUri: sourceMap.mappedDocument.uri };
							}

							const completionList: vscode.CompletionList = {
								...embeddedCompletionList,
								items: embeddedCompletionList.items.map(item => ({
									...transformCompletionItem(
										item,
										embeddedRange => sourceMap.getSourceRange(embeddedRange.start, embeddedRange.end)?.[0],
									),
									data: <PluginCompletionData>{
										uri,
										originalItem: item,
										pluginId: plugin.id,
										sourceMapId: sourceMap.id,
										embeddedDocumentUri: sourceMap.mappedDocument.uri,
									} as any,
								})),
							};

							cache!.data.push({
								sourceMapId: sourceMap.id,
								embeddedDocumentUri: sourceMap.mappedDocument.uri,
								plugin,
								list: completionList,
							});
						}
					}

					return true;
				});
			}

			if (document) {

				const plugins = getPlugins('script');

				for (const plugin of plugins) {

					if (!plugin.doComplete)
						continue;

					if (context?.triggerCharacter && !plugin.context?.triggerCharacters?.includes(context.triggerCharacter))
						continue;

					if (cache.mainCompletion && (!plugin.context?.isAdditionalCompletion || cache.mainCompletion.documentUri !== document.uri))
						continue;

					const completionList = await plugin.doComplete(document, position, context);

					if (!completionList)
						continue;

					if (!plugin.context?.isAdditionalCompletion) {
						cache.mainCompletion = { documentUri: document.uri };
					}

					cache.data.push({
						sourceMapId: undefined,
						embeddedDocumentUri: undefined,
						plugin,
						list: {
							...completionList,
							items: completionList.items.map(item => ({
								...item,
								data: <PluginCompletionData>{
									uri,
									originalItem: item,
									pluginId: plugin.id,
									sourceMapId: undefined,
									embeddedDocumentUri: undefined,
								} as any,
							}))
						},
					});
				}
			}
		}

		return combineCompletionList(cache.data.map(cacheData => cacheData.list));

		function combineCompletionList(lists: vscode.CompletionList[]) {
			return {
				isIncomplete: lists.some(list => list.isIncomplete),
				items: lists.map(list => list.items).flat().filter((result: vscode.CompletionItem) =>
					result.label.indexOf('__VLS_') === -1
					&& (!result.labelDetails?.description || result.labelDetails.description.indexOf('__VLS_') === -1)
				),
			};
		}
	}
}
