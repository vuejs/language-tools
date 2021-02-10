import type { SourceMap } from '..';
import type { Hover } from 'vscode-languageserver';

export function transform(hover: Hover | undefined | null, sourceMap: SourceMap): Hover | undefined | null {
    if (!hover?.range) {
        return hover;
    }
    const vueLoc = sourceMap.targetToSource(hover.range);
    if (vueLoc) {
        return {
            ...hover,
            range: vueLoc.range,
        };
    }
}
