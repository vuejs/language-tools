import {
    CompletionItem,
} from 'vscode-languageserver';
import { TsCompletionData } from '../utils/types';
import { SourceFile } from '../sourceFiles';
import { findSourceFileByTsUri } from '../utils/commons';

export function register(sourceFiles: Map<string, SourceFile>) {
    return (item: CompletionItem) => {
        const data: TsCompletionData = item.data;
        if (data.mode === 'ts') {
            const sourceFile = findSourceFileByTsUri(sourceFiles, data.tsUri);
            if (sourceFile) {
                for (const sourceMap of sourceFile.getTsSourceMaps()) {
                    if (sourceMap.targetDocument.uri !== data.tsUri) continue;
                    item = sourceMap.languageService.doCompletionResolve(item);
                    if (item.additionalTextEdits) {
                        for (const textEdit of item.additionalTextEdits) {
                            const vueLoc = sourceMap.findSource(textEdit.range);
                            if (vueLoc) {
                                textEdit.range = vueLoc.range;
                            }
                        }
                    }
                }
            }
        }
        return item;
    }
}
