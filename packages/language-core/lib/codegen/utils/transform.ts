import type { Code } from '../../types';

export interface CodeTransform {
	range: [start: number, end: number];
	generate(): Iterable<Code>;
}

export function replace(start: number, end: number, replacement: () => Iterable<Code>): CodeTransform {
	return {
		range: [start, end],
		generate: replacement,
	};
}

export function insert(position: number, insertion: () => Iterable<Code>): CodeTransform {
	return {
		range: [position, position],
		generate: insertion,
	};
}

export function* generateCodeWithTransforms(
	start: number,
	end: number,
	transforms: CodeTransform[],
	section: (start: number, end: number) => Iterable<Code>,
): Generator<Code> {
	const sortedTransforms = transforms.sort((a, b) => a.range[0] - b.range[0]);
	for (const { range, generate } of sortedTransforms) {
		yield* section(start, range[0]);
		yield* generate();
		start = range[1];
	}
	yield* section(start, end);
}
