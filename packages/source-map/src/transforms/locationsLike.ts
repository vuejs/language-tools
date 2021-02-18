import type { SourceMap } from '..';
import type { Range } from 'vscode-languageserver';
import { transform as transformLocation } from './locationLike';
import { notEmpty } from '@volar/shared';

export function transform<T extends { range: Range }>(locations: T[], sourceMap: SourceMap): T[] {
    return locations
        .map(location => transformLocation(location, sourceMap))
        .filter(notEmpty);
}
