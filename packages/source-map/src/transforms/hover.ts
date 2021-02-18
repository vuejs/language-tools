import type { SourceMap } from '..';
import type { Hover } from 'vscode-languageserver';

export function transform(hover: Hover, sourceMap: SourceMap): Hover | undefined {

    if (!hover?.range) {
        return hover;
    }

    const range = sourceMap.targetToSource(hover.range.start, hover.range.end);
    if (!range) return;

    return {
        ...hover,
        range,
    };
}
