import {
	Position,
	Range,
	CallHierarchyItem,
	CallHierarchyIncomingCall,
	CallHierarchyOutgoingCall,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFile } from '../sourceFiles';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import { notEmpty } from '@volar/shared';
import { duplicateLocations, duplicateCallHierarchyIncomingCall, duplicateCallHierarchyOutgoingCall } from '../utils/commons';
import * as upath from 'upath';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	function prepareCallHierarchy(document: TextDocument, position: Position) {
		let vueItems: CallHierarchyItem[] = [];

		if (document.languageId !== 'vue') {
			const items = worker(document, position);
			vueItems = vueItems.concat(items);
		}
		else {
			const sourceFile = sourceFiles.get(document.uri);
			if (sourceFile) {
				for (const sourceMap of sourceFile.getTsSourceMaps()) {
					for (const tsLoc of sourceMap.sourceToTargets({ start: position, end: position })) {
						if (!tsLoc.maped.data.capabilities.references) continue;
						const items = worker(sourceMap.targetDocument, tsLoc.range.start);
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

		return duplicateLocations(vueItems);
	}
	function provideCallHierarchyIncomingCalls(item: CallHierarchyItem) {
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
		return duplicateCallHierarchyIncomingCall(vueIncomingItems);
	}
	function provideCallHierarchyOutgoingCalls(item: CallHierarchyItem) {
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
		return duplicateCallHierarchyOutgoingCall(vueIncomingItems);
	}

	return {
		prepareCallHierarchy,
		provideCallHierarchyIncomingCalls,
		provideCallHierarchyOutgoingCalls,
	}

	function worker(tsDoc: TextDocument, tsPos: Position) {
		const vueOrTsItems: CallHierarchyItem[] = [];
		const tsItems = tsLanguageService.prepareCallHierarchy(tsDoc, tsPos);
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
					name: tsItem.name === upath.basename(sourceMap.targetDocument.uri) ? upath.basename(sourceMap.sourceDocument.uri) : tsItem.name,
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
						if (!tsLoc.maped.data.capabilities.references) continue;
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
