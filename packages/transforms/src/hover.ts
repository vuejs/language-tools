import type { Hover, Range } from 'vscode-languageserver';

export function transform(hover: Hover, getOtherRange: (range: Range) => Range | undefined): Hover | undefined {

	if (!hover?.range) {
		return hover;
	}

	const range = getOtherRange(hover.range);
	if (!range) return;

	return {
		...hover,
		range,
	};
}
