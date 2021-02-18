import type { SourceMap } from '..';
import type { CompletionList } from 'vscode-languageserver-types';
import { transform as transformCompletionItem } from './completionItem';

export function transform(completionList: CompletionList, sourceMap: SourceMap): CompletionList {
    return {
        isIncomplete: completionList.isIncomplete,
        items: completionList.items.map(item => transformCompletionItem(item, sourceMap)),
    };
}
