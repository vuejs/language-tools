import { notEmpty, uriToFsPath } from '@volar/shared';
import * as upath from 'upath';
import type {
	CallHierarchyIncomingCall,
	CallHierarchyItem,
	CallHierarchyOutgoingCall,
	Position,
	Range
} from 'vscode-languageserver/node';
import type { ApiLanguageServiceContext } from '../types';
import * as dedupe from '../utils/dedupe';

export function register({ sourceFiles, tsLs }: ApiLanguageServiceContext) {
	function doPrepare(uri: string, position: Position) {
		let vueItems: CallHierarchyItem[] = [];

		const sourceFile = sourceFiles.get(uri);
		if (sourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsRange of sourceMap.getMappedRanges(position)) {
					if (!tsRange.data.capabilities.references) continue;
					const items = worker(sourceMap.mappedDocument.uri, tsRange.start);
					vueItems = vueItems.concat(items);
				}
			}
		}
		else {
			vueItems = worker(uri, position);
		}

		for (const vueItem of vueItems) {
			vueItem.data = {
				uri: uri,
			};
		}

		return dedupe.withLocations(vueItems);
	}
	function getIncomingCalls(item: CallHierarchyItem) {
		const tsItems = tsTsCallHierarchyItem(item);
		const tsIncomingItems = tsItems.map(tsLs.callHierarchy.getIncomingCalls).flat();
		const vueIncomingItems: CallHierarchyIncomingCall[] = [];
		for (const tsIncomingItem of tsIncomingItems) {
			const vueResult = toVueCallHierarchyItem(tsIncomingItem.from, tsIncomingItem.fromRanges);
			if (!vueResult) continue;
			const [vueItem, vueRanges] = vueResult;
			vueIncomingItems.push({
				from: vueItem,
				fromRanges: vueRanges,
			});
		}
		return dedupe.withCallHierarchyIncomingCalls(vueIncomingItems);
	}
	function getOutgoingCalls(item: CallHierarchyItem) {
		const tsItems = tsTsCallHierarchyItem(item);
		const tsIncomingItems = tsItems.map(tsLs.callHierarchy.getOutgoingCalls).flat();
		const vueIncomingItems: CallHierarchyOutgoingCall[] = [];
		for (const tsIncomingItem of tsIncomingItems) {
			const vueResult = toVueCallHierarchyItem(tsIncomingItem.to, tsIncomingItem.fromRanges);
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

	function worker(tsDocUri: string, tsPos: Position) {
		const vueOrTsItems: CallHierarchyItem[] = [];
		const tsItems = tsLs.callHierarchy.doPrepare(tsDocUri, tsPos);
		for (const tsItem of tsItems) {
			const result = toVueCallHierarchyItem(tsItem, []);
			if (!result) continue;
			const [vueItem] = result;
			if (vueItem) {
				vueOrTsItems.push(vueItem);
			}
		}
		return vueOrTsItems;
	}
	function toVueCallHierarchyItem(tsItem: CallHierarchyItem, tsRanges: Range[]): [CallHierarchyItem, Range[]] | undefined {
		if (!sourceFiles.getTsDocuments().get(tsItem.uri)) {
			return [tsItem, tsRanges]; // not virtual file
		}

		const sourceMap = sourceFiles.getTsSourceMaps().get(tsItem.uri);
		if (!sourceMap)
			return;

		let vueRange: Range | undefined = sourceMap.getSourceRange(tsItem.range.start, tsItem.range.end);
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

		const vueRanges = tsRanges.map(tsRange => sourceMap.getSourceRange(tsRange.start, tsRange.end)).filter(notEmpty);
		const vueItem: CallHierarchyItem = {
			...tsItem,
			name: tsItem.name === upath.basename(uriToFsPath(sourceMap.mappedDocument.uri)) ? upath.basename(uriToFsPath(sourceMap.sourceDocument.uri)) : tsItem.name,
			uri: sourceMap.sourceDocument.uri,
			range: vueRange,
			selectionRange: vueSelectionRange,
		}

		return [vueItem, vueRanges];
	}
	function tsTsCallHierarchyItem(item: CallHierarchyItem) {
		if (upath.extname(item.uri) !== '.vue') {
			return [item];
		}

		const tsItems: CallHierarchyItem[] = [];

		const sourceFile = sourceFiles.get(item.uri);
		if (sourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				const tsLocs = sourceMap.getMappedRanges(item.range.start, item.range.end);
				const tsSelectionRanges = sourceMap.getMappedRanges(item.selectionRange.start, item.selectionRange.end);
				if (tsLocs.length) {
					for (const tsRange of tsLocs) {
						if (!tsRange.data.capabilities.references) continue;
						for (const tsSelectionRange of tsSelectionRanges) {
							tsItems.push({
								...item,
								uri: sourceMap.mappedDocument.uri,
								range: tsRange,
								selectionRange: tsSelectionRange,
							});
						}
					}
				}
				else {
					for (const maped of sourceMap) {
						if (maped.data.capabilities.references) {
							for (const tsSelectionRange of tsSelectionRanges) {
								tsItems.push({
									...item,
									uri: sourceMap.mappedDocument.uri,
									range: {
										start: sourceMap.mappedDocument.positionAt(0),
										end: sourceMap.mappedDocument.positionAt(sourceMap.mappedDocument.getText().length),
									},
									selectionRange: tsSelectionRange,
								});
							}
							break;
						}
					}
				}
			}
		}

		return tsItems;
	}
}
