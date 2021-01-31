import type { TsApiRegisterOptions } from '../types';
import {
	Position,
	Range,
	CallHierarchyItem,
	CallHierarchyIncomingCall,
	CallHierarchyOutgoingCall,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { notEmpty, uriToFsPath } from '@volar/shared';
import * as upath from 'upath';
import * as dedupe from '../utils/dedupe';

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {
	function onPrepare(document: TextDocument, position: Position) {
		let vueItems: CallHierarchyItem[] = [];

		if (document.languageId !== 'vue') {
			vueItems = worker(document.uri, position);
		}
		else {
			const sourceFile = sourceFiles.get(document.uri);
			if (sourceFile) {
				for (const sourceMap of sourceFile.getTsSourceMaps()) {
					for (const tsLoc of sourceMap.sourceToTargets({ start: position, end: position })) {
						if (!tsLoc.data.capabilities.references) continue;
						const items = worker(sourceMap.targetDocument.uri, tsLoc.range.start);
						vueItems = vueItems.concat(items);
					}
				}
			}
		}

		for (const vueItem of vueItems) {
			vueItem.data = {
				uri: document.uri,
				offset: document.offsetAt(position),
			};
		}

		return dedupe.withLocations(vueItems);
	}
	function onIncomingCalls(item: CallHierarchyItem) {
		const tsItems = tsTsCallHierarchyItem(item);
		const tsIncomingItems = tsItems.map(tsLanguageService.provideCallHierarchyIncomingCalls).flat();
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
	function onOutgoingCalls(item: CallHierarchyItem) {
		const tsItems = tsTsCallHierarchyItem(item);
		const tsIncomingItems = tsItems.map(tsLanguageService.provideCallHierarchyOutgoingCalls).flat();
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
		onPrepare,
		onIncomingCalls,
		onOutgoingCalls,
	}

	function worker(tsDocUri: string, tsPos: Position) {
		const vueOrTsItems: CallHierarchyItem[] = [];
		const tsItems = tsLanguageService.prepareCallHierarchy(tsDocUri, tsPos);
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
		let isVirtual = false;
		for (const sourceFile of sourceFiles.values()) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				if (sourceMap.targetDocument.uri !== tsItem.uri) {
					continue;
				}
				isVirtual = true;
				let vueRange = sourceMap.targetToSource(tsItem.range)?.range;
				if (!vueRange) {
					// TODO: <script> range
					vueRange = {
						start: sourceMap.sourceDocument.positionAt(0),
						end: sourceMap.sourceDocument.positionAt(sourceMap.sourceDocument.getText().length),
					};
				}
				const vueSelectionLoc = sourceMap.targetToSource(tsItem.selectionRange);
				if (!vueSelectionLoc) {
					continue;
				}
				const vueRanges = tsRanges.map(tsRange => sourceMap.targetToSource(tsRange)?.range).filter(notEmpty);
				const vueItem: CallHierarchyItem = {
					...tsItem,
					name: tsItem.name === upath.basename(uriToFsPath(sourceMap.targetDocument.uri)) ? upath.basename(uriToFsPath(sourceMap.sourceDocument.uri)) : tsItem.name,
					uri: sourceMap.sourceDocument.uri,
					range: vueRange,
					selectionRange: vueSelectionLoc.range,
				}
				return [vueItem, vueRanges];
			}
		}
		if (!isVirtual) {
			return [tsItem, tsRanges];
		}
	}
	function tsTsCallHierarchyItem(item: CallHierarchyItem) {
		if (upath.extname(item.uri) !== '.vue') {
			return [item];
		}

		const tsItems: CallHierarchyItem[] = [];

		const sourceFile = sourceFiles.get(item.uri);
		if (sourceFile) {
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				const tsLocs = sourceMap.sourceToTargets(item.range);
				const tsSelectionLocs = sourceMap.sourceToTargets(item.selectionRange);
				if (tsLocs.length) {
					for (const tsLoc of tsLocs) {
						if (!tsLoc.data.capabilities.references) continue;
						for (const tsSelectionLoc of tsSelectionLocs) {
							tsItems.push({
								...item,
								uri: sourceMap.targetDocument.uri,
								range: tsLoc.range,
								selectionRange: tsSelectionLoc.range,
							});
						}
					}
				}
				else {
					for (const maped of sourceMap) {
						if (maped.data.capabilities.references) {
							for (const tsSelectionLoc of tsSelectionLocs) {
								tsItems.push({
									...item,
									uri: sourceMap.targetDocument.uri,
									range: {
										start: sourceMap.targetDocument.positionAt(0),
										end: sourceMap.targetDocument.positionAt(sourceMap.targetDocument.getText().length),
									},
									selectionRange: tsSelectionLoc.range,
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
