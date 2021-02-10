import type { SourceMap } from '..';
import type { Range } from 'vscode-languageserver';

export function transform<T extends { range: Range }>(highlights: T[], sourceMap: SourceMap): T[] {
    const result: T[] = [];
    for (const highlight of highlights) {
        const vueLoc = sourceMap.targetToSource(highlight.range);
        if (vueLoc) {
            result.push({
                ...highlight,
                range: vueLoc.range,
            });
        }
    }
    return result;
}
