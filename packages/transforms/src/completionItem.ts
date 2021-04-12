import type { CompletionItem, Range } from 'vscode-languageserver';
import { transform as transformLocations } from './locationsLike';
import { transform as transformTextEdit } from './textEdit';

export function transform(item: CompletionItem, getOtherRange: (range: Range) => Range | undefined): CompletionItem {
    return {
        ...item,
        additionalTextEdits: item.additionalTextEdits
            ? transformLocations(item.additionalTextEdits, getOtherRange)
            : undefined,
        textEdit: item.textEdit
            ? transformTextEdit(item.textEdit, getOtherRange)
            : undefined,
    };
}
