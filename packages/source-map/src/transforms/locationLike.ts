import type { SourceMap } from '..';
import type { Range } from 'vscode-languageserver-types';

export function transform<T extends { range: Range }>(location: T, sourceMap: SourceMap): T | undefined {

    const range = sourceMap.getSourceRange(location.range.start, location.range.end);
    if (!range) return;

    return {
        ...location,
        range,
    };
}
