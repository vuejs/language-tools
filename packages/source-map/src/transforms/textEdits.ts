import type { SourceMap } from '..';
import { TextEdit } from 'vscode-languageserver';

export function transform(textEdits: TextEdit[] | undefined, sourceMap: SourceMap) {
    if (textEdits) {
        const output: TextEdit[] = [];
        for (const textEdit of textEdits) {
            const vueRange = sourceMap.targetToSource(textEdit.range.start, textEdit.range.end);
            if (vueRange) {
                output.push({
                    newText: textEdit.newText,
                    range: vueRange,
                });
            }
        }
        return output;
    }
    return undefined;
}
