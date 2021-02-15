import type { SourceMap } from '..';
import type { Hover } from 'vscode-languageserver';

export function transform(hover: Hover | undefined | null, sourceMap: SourceMap): Hover | undefined | null {
    if (!hover?.range) {
        return hover;
    }
    const vueRange = sourceMap.targetToSource(hover.range.start, hover.range.end);
    if (vueRange) {
        return {
            ...hover,
            range: vueRange,
        };
    }
}
