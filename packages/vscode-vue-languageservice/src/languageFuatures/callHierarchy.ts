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
	sourceMapId: number | undefined,
	embeddedDocumentUri: string | undefined,
}

export function register(context: LanguageServiceRuntimeContext) {

	return {

		doPrepare(uri: string, position: vscode.Position) {

			return languageFeatureWorker(
				context,
				uri,
				position,
				function* (position, sourceMap) {
					for (const [mapedRange] of sourceMap.getMappedRanges(
						position,
						position,
						data => !!data.capabilities.references,
					)) {
						yield mapedRange.start;
					}
				},
				(plugin, document, position) => plugin.callHierarchy?.doPrepare?.(document, position),
				(data, sourceMap, plugin) => data
					.map(item => transformCallHierarchyItem(sourceMap.lsType, item, [])?.[0])
					.filter(shared.notEmpty)
					.map(item => ({
						...item,
						data: <PluginCallHierarchyData>{
							uri,
							originalItem: item,
							pluginId: plugin.id,
							sourceMapId: sourceMap.id,
							embeddedDocumentUri: sourceMap.mappedDocument.uri,
						} as any,
					})),
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

				if (data.sourceMapId !== undefined && data.embeddedDocumentUri !== undefined) {

					const sourceMap = context.sourceFiles.getSourceMap(data.sourceMapId, data.embeddedDocumentUri);

					if (sourceMap) {

						const _calls = await plugin.callHierarchy.getIncomingCalls(originalItem);

						for (const call of _calls) {

							const vueResult = transformCallHierarchyItem(sourceMap.lsType, call.from, call.fromRanges);

							if (!vueResult)
								continue;

							incomingItems.push({
								from: vueResult[0],
								fromRanges: vueResult[1],
							});
						}
					}
				}
				else {

					const calls = await plugin.callHierarchy.getIncomingCalls(item);

					incomingItems = incomingItems.concat(calls);
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

				if (data.sourceMapId !== undefined && data.embeddedDocumentUri !== undefined) {

					const sourceMap = context.sourceFiles.getSourceMap(data.sourceMapId, data.embeddedDocumentUri);

					if (sourceMap) {

						const _calls = await plugin.callHierarchy.getOutgoingCalls(originalItem);

						for (const call of _calls) {

							const vueResult = transformCallHierarchyItem(sourceMap.lsType, call.to, call.fromRanges);

							if (!vueResult)
								continue;

							items.push({
								to: vueResult[0],
								fromRanges: vueResult[1],
							});
						}
					}
				}
				else {

					const calls = await plugin.callHierarchy.getOutgoingCalls(item);

					items = items.concat(calls);
				}
			}

			return dedupe.withCallHierarchyOutgoingCalls(items);
		},
	};

	function transformCallHierarchyItem(lsType: 'script' | 'template' | undefined, tsItem: vscode.CallHierarchyItem, tsRanges: vscode.Range[]): [vscode.CallHierarchyItem, vscode.Range[]] | undefined {

		const sourceMap = context.sourceFiles.fromEmbeddedDocumentUri(lsType, tsItem.uri);
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
