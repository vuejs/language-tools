import type * as vscode from 'vscode-languageserver-types';
import { transform as transformCompletionItem } from './completionItem';

export function transform<T extends vscode.CompletionList>(completionList: T, getOtherRange: (range: vscode.Range) => vscode.Range | undefined): T {
	return {
		isIncomplete: completionList.isIncomplete,
		items: completionList.items.map(item => transformCompletionItem(item, getOtherRange)),
	} as T;
}
