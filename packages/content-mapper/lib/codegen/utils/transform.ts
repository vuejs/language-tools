import type { TsCode } from '../../boundary';

export interface CodeTransform {
	range: [start: number, end: number];
	generate(): Iterable<TsCode>;
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

export function* generateCodeWithTransforms(
	start: number,
	end: number,
	transforms: CodeTransform[],
	section: (start: number, end: number) => Iterable<TsCode>,
): Generator<TsCode> {
	const sortedTransforms = transforms.sort((a, b) => a.range[0] - b.range[0]);
	for (const { range, generate } of sortedTransforms) {
		yield* section(start, range[0]);
		yield* generate();
		start = range[1];
	}
	yield* section(start, end);
}
