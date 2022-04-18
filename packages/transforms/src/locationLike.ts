import type { Range } from 'vscode-languageserver-types';

export function transform<T extends { range: Range; }>(location: T, getOtherRange: (range: Range) => Range | undefined): T | undefined {

	const range = getOtherRange(location.range);
	if (!range) return;

	return {
		...location,
		range,
	};
}
