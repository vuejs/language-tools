import type { SourceMap } from '..';
import type { CompletionList } from 'vscode-languageserver';
import type { CompletionItem } from 'vscode-languageserver';
import { transform as transformTextEdit } from './textEdit';
import { transform as transformTextEdits } from './textEdits';

export function transform(completionList: CompletionList, sourceMap: SourceMap): CompletionList {

    const sourceItems: CompletionItem[] = completionList.items.map<CompletionItem>(item => ({
        ...item,
        additionalTextEdits: transformTextEdits(item.additionalTextEdits, sourceMap),
        textEdit: transformTextEdit(item.textEdit, sourceMap),
    }));

    return {
        isIncomplete: completionList.isIncomplete,
        items: sourceItems,
    };
}
