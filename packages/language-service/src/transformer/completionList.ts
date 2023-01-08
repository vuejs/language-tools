import * as vscode from 'vscode-languageserver-protocol';
import { transform as transformCompletionItem } from './completionItem';

export function transform<T extends vscode.CompletionList>(
	completionList: T,
	getOtherRange: (range: vscode.Range) => vscode.Range | undefined,
	document: vscode.TextDocument,
	onItem?: (newItem: vscode.CompletionItem, oldItem: vscode.CompletionItem) => void,
): T {
	return {
		isIncomplete: completionList.isIncomplete,
		itemDefaults: completionList.itemDefaults ? {
			...completionList.itemDefaults,
			editRange: completionList.itemDefaults.editRange
				? 'replace' in completionList.itemDefaults.editRange
					? {
						insert: getOtherRange(completionList.itemDefaults.editRange.insert),
						replace: getOtherRange(completionList.itemDefaults.editRange.replace),
					}
					: getOtherRange(completionList.itemDefaults.editRange)
				: undefined,
		} : undefined,
		items: completionList.items.map(item => {
			const newItem = transformCompletionItem(item, getOtherRange, document);
			onItem?.(newItem, item);
			return newItem;
		}),
	} as T;
}
