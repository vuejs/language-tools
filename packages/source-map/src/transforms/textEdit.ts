import type { SourceMap } from '..';
import type { InsertReplaceEdit } from 'vscode-languageserver-types';
import { TextEdit } from 'vscode-languageserver';

export function transform(textEdit: TextEdit | InsertReplaceEdit | undefined, sourceMap: SourceMap) {
    if (textEdit && TextEdit.is(textEdit)) {
        const vueLoc = sourceMap.targetToSource(textEdit.range);
        if (vueLoc) {
            return {
                newText: textEdit.newText,
                range: vueLoc.range,
            };
        }
    }
    return undefined;
}
