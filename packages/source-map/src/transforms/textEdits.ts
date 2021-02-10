import type { SourceMap } from '..';
import { TextEdit } from 'vscode-languageserver';

export function transform(textEdits: TextEdit[] | undefined, sourceMap: SourceMap) {
    if (textEdits) {
        const output: TextEdit[] = [];
        for (const textEdit of textEdits) {
            const vueLoc = sourceMap.targetToSource(textEdit.range);
            if (vueLoc) {
                output.push({
                    newText: textEdit.newText,
                    range: vueLoc.range,
                });
            }
        }
        return output;
    }
    return undefined;
}
