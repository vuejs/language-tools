import * as shared from '@volar/shared';
import * as upath from 'upath';
import type * as vscode from 'vscode-languageserver';
import type { ApiLanguageServiceContext } from '../types';
import * as dedupe from '../utils/dedupe';

export interface Data {
	lsType: 'script' | 'template'
	tsData: any
}

export function register({ sourceFiles, getTsLs }: ApiLanguageServiceContext) {
	function doPrepare(uri: string, position: vscode.Position) {
		let vueItems: vscode.CallHierarchyItem[] = [];

		for (const tsLoc of sourceFiles.toTsLocations(uri, position)) {

			if (tsLoc.type === 'embedded-ts' && !tsLoc.range.data.capabilities.references)
				continue;

			const items = worker(tsLoc.lsType, tsLoc.uri, tsLoc.range.start);
			for (const item of items) {
				const data: Data = {
					lsType: tsLoc.lsType,
					tsData: item.data,
				};
				item.data = data;
			}
			vueItems = vueItems.concat(items);
		}

		return dedupe.withLocations(vueItems);
	}
	function getIncomingCalls(item: vscode.CallHierarchyItem) {
		const data: Data | undefined = item.data as any;
		const lsType = data?.lsType ?? 'template';
		const tsLs = getTsLs(lsType);
		const tsItems = tsTsCallHierarchyItem(item);
		const tsIncomingItems = tsItems.map(tsLs.callHierarchy.getIncomingCalls).flat();
		const vueIncomingItems: vscode.CallHierarchyIncomingCall[] = [];
		for (const tsIncomingItem of tsIncomingItems) {
			const vueResult = toVueCallHierarchyItem(lsType, tsIncomingItem.from, tsIncomingItem.fromRanges);
			if (!vueResult) continue;
			const [vueItem, vueRanges] = vueResult;
			vueIncomingItems.push({
				from: vueItem,
				fromRanges: vueRanges,
			});
		}
		return dedupe.withCallHierarchyIncomingCalls(vueIncomingItems);
	}
	function getOutgoingCalls(item: vscode.CallHierarchyItem) {
		const data: Data | undefined = item.data as any;
		const lsType = data?.lsType ?? 'template';
		const tsLs = getTsLs(lsType);
		const tsItems = tsTsCallHierarchyItem(item);
		const tsIncomingItems = tsItems.map(tsLs.callHierarchy.getOutgoingCalls).flat();
		const vueIncomingItems: vscode.CallHierarchyOutgoingCall[] = [];
		for (const tsIncomingItem of tsIncomingItems) {
			const vueResult = toVueCallHierarchyItem(lsType, tsIncomingItem.to, tsIncomingItem.fromRanges);
			if (!vueResult) continue;
			const [vueItem, vueRanges] = vueResult;
			vueIncomingItems.push({
				to: vueItem,
				fromRanges: vueRanges,
			});
		}
		return dedupe.withCallHierarchyOutgoingCalls(vueIncomingItems);
	}

	return {
		doPrepare,
		getIncomingCalls,
		getOutgoingCalls,
	}

	function worker(lsType: 'script' | 'template', tsDocUri: string, tsPos: vscode.Position) {
		const vueOrTsItems: vscode.CallHierarchyItem[] = [];
		const tsLs = getTsLs(lsType);
		const tsItems = tsLs.callHierarchy.doPrepare(tsDocUri, tsPos);
		for (const tsItem of tsItems) {
			const result = toVueCallHierarchyItem(lsType, tsItem, []);
			if (!result) continue;
			const [vueItem] = result;
			if (vueItem) {
				vueOrTsItems.push(vueItem);
			}
		}
		for (const item of vueOrTsItems) {
			if (!item.data) item.data = {};
			(item.data as any).uri = tsDocUri;
		}
		return vueOrTsItems;
	}
	function toVueCallHierarchyItem(lsType: 'script' | 'template', tsItem: vscode.CallHierarchyItem, tsRanges: vscode.Range[]): [vscode.CallHierarchyItem, vscode.Range[]] | undefined {
		if (!sourceFiles.getTsDocuments(lsType).get(tsItem.uri)) {
			return [tsItem, tsRanges]; // not virtual file
		}

		const sourceMap = sourceFiles.getTsSourceMaps(lsType).get(tsItem.uri);
		if (!sourceMap)
			return;

		let vueRange: vscode.Range | undefined = sourceMap.getSourceRange(tsItem.range.start, tsItem.range.end);
		if (!vueRange) {
			// TODO: <script> range
			vueRange = {
				start: sourceMap.sourceDocument.positionAt(0),
				end: sourceMap.sourceDocument.positionAt(sourceMap.sourceDocument.getText().length),
			};
		}

		const vueSelectionRange = sourceMap.getSourceRange(tsItem.selectionRange.start, tsItem.selectionRange.end);
		if (!vueSelectionRange)
			return;

		const vueRanges = tsRanges.map(tsRange => sourceMap.getSourceRange(tsRange.start, tsRange.end)).filter(shared.notEmpty);
		const vueItem: vscode.CallHierarchyItem = {
			...tsItem,
			name: tsItem.name === upath.basename(shared.uriToFsPath(sourceMap.mappedDocument.uri)) ? upath.basename(shared.uriToFsPath(sourceMap.sourceDocument.uri)) : tsItem.name,
			uri: sourceMap.sourceDocument.uri,
			range: vueRange,
			selectionRange: vueSelectionRange,
		}

		return [vueItem, vueRanges];
	}
	function tsTsCallHierarchyItem(item: vscode.CallHierarchyItem) {
		if (upath.extname(item.uri) !== '.vue') {
			return [item];
		}

		const tsItems: vscode.CallHierarchyItem[] = [];

		for (const tsLoc of sourceFiles.toTsLocations(item.uri, item.range.start, item.range.end)) {

			if (tsLoc.type === 'embedded-ts' && !tsLoc.range.data.capabilities.references)
				continue;

			for (const tsSelectionLoc of sourceFiles.toTsLocations(item.uri, item.selectionRange.start, item.selectionRange.end)) {

				if (tsSelectionLoc.type === 'embedded-ts' && !tsSelectionLoc.range.data.capabilities.references)
					continue;

				tsItems.push({
					...item,
					uri: tsLoc.uri,
					range: tsLoc.range,
					selectionRange: tsSelectionLoc.range,
				});
			}
		}

		return tsItems;
	}
}
