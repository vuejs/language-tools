import type { SourceMap } from '..';
import type { InsertReplaceEdit } from 'vscode-languageserver-types';
import { TextEdit } from 'vscode-languageserver';

export function transform(textEdit: TextEdit | InsertReplaceEdit | undefined, sourceMap: SourceMap) {
    if (textEdit && TextEdit.is(textEdit)) {
        const vueRange = sourceMap.targetToSource(textEdit.range.start, textEdit.range.end);
        if (vueRange) {
            return {
                newText: textEdit.newText,
                range: vueRange,
            };
        }
    }
    return undefined;
}
