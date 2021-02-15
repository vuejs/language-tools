import type { SourceMap } from '..';
import type { Range } from 'vscode-languageserver';

export function transform<T extends { range: Range }>(highlights: T[], sourceMap: SourceMap): T[] {
    const result: T[] = [];
    for (const highlight of highlights) {
        const vueRange = sourceMap.targetToSource(highlight.range.start, highlight.range.end);
        if (vueRange) {
            result.push({
                ...highlight,
                range: vueRange,
            });
        }
    }
    return result;
}
