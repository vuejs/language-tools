import * as shared from '@volar/shared';
import * as upath from 'upath';
import type * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { languageFeatureWorker } from '../utils/featureWorkers';

export interface PluginCallHierarchyData {
	uri: string,
	originalItem: vscode.CallHierarchyItem,
	pluginId: number,
	sourceMap: {
		embeddedDocumentUri: string
	} | undefined,
}

export function register(context: LanguageServiceRuntimeContext) {

	return {

		doPrepare(uri: string, position: vscode.Position) {

			return languageFeatureWorker(
				context,
				uri,
				position,
				function* (position, sourceMap) {
					for (const [mappedRange] of sourceMap.getMappedRanges(
						position,
						position,
						data => !!data.capabilities.references,
					)) {
						yield mappedRange.start;
					}
				},
				async (plugin, document, position, sourceMap) => {

					const items = await plugin.callHierarchy?.doPrepare(document, position);

					return items?.map(item => {

						const data: PluginCallHierarchyData = {
							uri,
							originalItem: item,
							pluginId: plugin.id,
							sourceMap: sourceMap ? {
								embeddedDocumentUri: sourceMap.mappedDocument.uri,
							} : undefined,
						};

						return <vscode.CallHierarchyItem>{
							...item,
							data: data as any,
						};
					});
				},
				(data, sourceMap) => !sourceMap ? data : data
					.map(item => transformCallHierarchyItem(item, [])?.[0])
					.filter(shared.notEmpty),
				arr => dedupe.withLocations(arr.flat()),
			);
		},

		async getIncomingCalls(item: vscode.CallHierarchyItem) {

			const data: PluginCallHierarchyData | undefined = item.data as any;
			let incomingItems: vscode.CallHierarchyIncomingCall[] = [];

			if (data) {

				const plugin = context.getPluginById(data.pluginId);

				if (!plugin)
					return incomingItems;

				if (!plugin.callHierarchy)
					return incomingItems;

				const originalItem = data.originalItem;

				if (data.sourceMap) {

					const sourceMap = context.vueDocuments.sourceMapFromEmbeddedDocumentUri(data.sourceMap.embeddedDocumentUri);

					if (sourceMap) {

						const _calls = await plugin.callHierarchy.getIncomingCalls(originalItem);

						for (const _call of _calls) {

							const calls = transformCallHierarchyItem(_call.from, _call.fromRanges);

							if (!calls)
								continue;

							incomingItems.push({
								from: calls[0],
								fromRanges: calls[1],
							});
						}
					}
				}
				else {

					const _calls = await plugin.callHierarchy.getIncomingCalls(item);

					for (const _call of _calls) {

						const calls = transformCallHierarchyItem(_call.from, _call.fromRanges);

						if (!calls)
							continue;

						incomingItems.push({
							from: calls[0],
							fromRanges: calls[1],
						});
					}
				}
			}

			return dedupe.withCallHierarchyIncomingCalls(incomingItems);
		},

		async getOutgoingCalls(item: vscode.CallHierarchyItem) {

			const data: PluginCallHierarchyData | undefined = item.data as any;
			let items: vscode.CallHierarchyOutgoingCall[] = [];

			if (data) {

				const plugin = context.getPluginById(data.pluginId);

				if (!plugin)
					return items;

				if (!plugin.callHierarchy)
					return items;

				const originalItem = data.originalItem;

				if (data.sourceMap) {

					const sourceMap = context.vueDocuments.sourceMapFromEmbeddedDocumentUri(data.sourceMap.embeddedDocumentUri);

					if (sourceMap) {

						const _calls = await plugin.callHierarchy.getOutgoingCalls(originalItem);

						for (const call of _calls) {

							const calls = transformCallHierarchyItem(call.to, call.fromRanges);

							if (!calls)
								continue;

							items.push({
								to: calls[0],
								fromRanges: calls[1],
							});
						}
					}
				}
				else {

					const _calls = await plugin.callHierarchy.getOutgoingCalls(item);

					for (const call of _calls) {

						const calls = transformCallHierarchyItem(call.to, call.fromRanges);

						if (!calls)
							continue;

						items.push({
							to: calls[0],
							fromRanges: calls[1],
						});
					}
				}
			}

			return dedupe.withCallHierarchyOutgoingCalls(items);
		},
	};

	function transformCallHierarchyItem(tsItem: vscode.CallHierarchyItem, tsRanges: vscode.Range[]): [vscode.CallHierarchyItem, vscode.Range[]] | undefined {

		const sourceMap = context.vueDocuments.sourceMapFromEmbeddedDocumentUri(tsItem.uri);
		if (!sourceMap)
			return [tsItem, tsRanges]; // not virtual file

		let vueRange: vscode.Range | undefined = sourceMap.getSourceRange(tsItem.range.start, tsItem.range.end)?.[0];
		if (!vueRange) {
			// TODO: <script> range
			vueRange = {
				start: sourceMap.sourceDocument.positionAt(0),
				end: sourceMap.sourceDocument.positionAt(sourceMap.sourceDocument.getText().length),
			};
		}

		const vueSelectionRange = sourceMap.getSourceRange(tsItem.selectionRange.start, tsItem.selectionRange.end)?.[0];
		if (!vueSelectionRange)
			return;

		const vueRanges = tsRanges.map(tsRange => sourceMap.getSourceRange(tsRange.start, tsRange.end)?.[0]).filter(shared.notEmpty);
		const vueItem: vscode.CallHierarchyItem = {
			...tsItem,
			name: tsItem.name === upath.basename(shared.uriToFsPath(sourceMap.mappedDocument.uri)) ? upath.basename(shared.uriToFsPath(sourceMap.sourceDocument.uri)) : tsItem.name,
			uri: sourceMap.sourceDocument.uri,
			range: vueRange,
			selectionRange: vueSelectionRange,
		};

		return [vueItem, vueRanges];
	}
}
