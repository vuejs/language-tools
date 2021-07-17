import { notEmpty } from '@volar/shared';
import type { Range } from 'vscode-languageserver';
import { transform as transformLocation } from './locationLike';

export function transform<T extends { range: Range }>(locations: T[], getOtherRange: (range: Range) => Range | undefined): T[] {
	return locations
		.map(location => transformLocation(location, getOtherRange))
		.filter(notEmpty);
}
