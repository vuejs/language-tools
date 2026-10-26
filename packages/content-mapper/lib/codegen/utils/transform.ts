import type { TsCode } from '../../boundary';

export interface CodeTransform {
	range: [start: number, end: number];
	generate(): Iterable<TsCode>;
	/** The `name` of the plugin entry that the transform is a script edit of; a transform of Vue has none. */
	plugin?: string;
}

export function replace(start: number, end: number, replacement: () => Iterable<TsCode>): CodeTransform {
	return {
		range: [start, end],
		generate: replacement,
	};
}

export function insert(position: number, insertion: () => Iterable<TsCode>): CodeTransform {
	return {
		range: [position, position],
		generate: insertion,
	};
}

/**
 * Generates `start`..`end` with the transforms applied in a total order: by start, inserts before a replace at the
 * same position, transforms of Vue before script edits of plugins, then in the order given.
 */
export function* generateCodeWithTransforms(
	start: number,
	end: number,
	transforms: CodeTransform[],
	section: (start: number, end: number) => Iterable<TsCode>,
): Generator<TsCode> {
	const sortedTransforms = transforms
		.map((transform, index) => ({ transform, index }))
		.sort((a, b) =>
			a.transform.range[0] - b.transform.range[0]
			|| Number(isReplace(a.transform)) - Number(isReplace(b.transform))
			|| Number(a.transform.plugin !== undefined) - Number(b.transform.plugin !== undefined)
			|| a.index - b.index
		);
	for (const { transform: { range, generate } } of sortedTransforms) {
		yield* section(start, range[0]);
		yield* generate();
		start = range[1];
	}
	yield* section(start, end);
}

function isReplace(transform: CodeTransform) {
	return transform.range[0] !== transform.range[1];
}
