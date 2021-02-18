import type { SourceMap } from '..';
import type { CompletionItem } from 'vscode-languageserver';
import { transform as transformTextEdit } from './textEdit';
import { transform as transformLocations } from './locationsLike';

export function transform(item: CompletionItem, sourceMap: SourceMap): CompletionItem {
    return {
        ...item,
        additionalTextEdits: item.additionalTextEdits
            ? transformLocations(item.additionalTextEdits, sourceMap)
            : undefined,
        textEdit: item.textEdit
            ? transformTextEdit(item.textEdit, sourceMap)
            : undefined,
    };
}
