import type { CompletionList, Range } from 'vscode-languageserver-types';
import { transform as transformCompletionItem } from './completionItem';

export function transform(completionList: CompletionList, getOtherRange: (range: Range) => Range | undefined): CompletionList {
	return {
		isIncomplete: completionList.isIncomplete,
		items: completionList.items.map(item => transformCompletionItem(item, getOtherRange)),
	};
}
