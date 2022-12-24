import * as shared from '@volar/shared';
import { posix as path } from 'path';
import type * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { languageFeatureWorker } from '../utils/featureWorkers';

export interface PluginCallHierarchyData {
	uri: string,
	originalItem: vscode.CallHierarchyItem,
	pluginId: number,
	map: {
		embeddedDocumentUri: string;
	} | undefined,
}

export function register(context: LanguageServiceRuntimeContext) {

	return {

		doPrepare(uri: string, position: vscode.Position) {

			return languageFeatureWorker(
				context,
				uri,
				position,
				(position, map) => map.toGeneratedPositions(position, data => !!data.references),
				async (plugin, document, position, map) => {

					const items = await plugin.callHierarchy?.prepare(document, position);

					return items?.map<vscode.CallHierarchyItem>(item => {
						return {
							...item,
							data: {
								uri,
								originalItem: item,
								pluginId: context.plugins.indexOf(plugin),
								map: map ? {
									embeddedDocumentUri: map.virtualFileDocument.uri,
								} : undefined,
							} satisfies PluginCallHierarchyData,
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

			const data: PluginCallHierarchyData | undefined = item.data;
			let incomingItems: vscode.CallHierarchyIncomingCall[] = [];

			if (data) {

				const plugin = context.plugins[data.pluginId];

				if (!plugin)
					return incomingItems;

				if (!plugin.callHierarchy)
					return incomingItems;

				const originalItem = data.originalItem;

				if (data.map) {

					if (context.documents.getVirtualFileByUri(data.map.embeddedDocumentUri)) {

						const _calls = await plugin.callHierarchy.onIncomingCalls(originalItem);

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

					const _calls = await plugin.callHierarchy.onIncomingCalls(item);

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

			const data: PluginCallHierarchyData | undefined = item.data;
			let items: vscode.CallHierarchyOutgoingCall[] = [];

			if (data) {

				const plugin = context.plugins[data.pluginId];

				if (!plugin)
					return items;

				if (!plugin.callHierarchy)
					return items;

				const originalItem = data.originalItem;

				if (data.map) {

					if (context.documents.getVirtualFileByUri(data.map.embeddedDocumentUri)) {

						const _calls = await plugin.callHierarchy.onOutgoingCalls(originalItem);

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

					const _calls = await plugin.callHierarchy.onOutgoingCalls(item);

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

		if (!context.documents.getVirtualFileByUri(tsItem.uri))
			return [tsItem, tsRanges];

		for (const [_, map] of context.documents.getMapsByVirtualFileUri(tsItem.uri)) {

			let range = map.toSourceRange(tsItem.range);
			if (!range) {
				// TODO: <script> range
				range = {
					start: map.sourceFileDocument.positionAt(0),
					end: map.sourceFileDocument.positionAt(map.sourceFileDocument.getText().length),
				};
			}

			const selectionRange = map.toSourceRange(tsItem.selectionRange);
			if (!selectionRange)
				continue;

			const vueRanges = tsRanges.map(tsRange => map.toSourceRange(tsRange)).filter(shared.notEmpty);
			const vueItem: vscode.CallHierarchyItem = {
				...tsItem,
				name: tsItem.name === path.basename(shared.getPathOfUri(map.virtualFileDocument.uri)) ? path.basename(shared.getPathOfUri(map.sourceFileDocument.uri)) : tsItem.name,
				uri: map.sourceFileDocument.uri,
				// TS Bug: `range: range` not works
				range: {
					start: range.start,
					end: range.end,
				},
				selectionRange: {
					start: selectionRange.start,
					end: selectionRange.end,
				},
			};

			selectionRange.end;

			return [vueItem, vueRanges];
		}
	}
}
