import type { Code } from '../../types';
import { newLine } from './index';

export function* generateIntersectMerge(generates: Iterable<Code>[]): Generator<Code> {
	yield* generates[0]!;
	for (let i = 1; i < generates.length; i++) {
		yield ` & `;
		yield* generates[i]!;
	}
}

export function* generateSpreadMerge(generates: Iterable<Code>[]): Generator<Code> {
	if (generates.length === 1) {
		yield* generates[0]!;
	}
	else {
		yield `{${newLine}`;
		for (const generate of generates) {
			yield `...`;
			yield* generate;
			yield `,${newLine}`;
		}
		yield `}`;
	}
}
