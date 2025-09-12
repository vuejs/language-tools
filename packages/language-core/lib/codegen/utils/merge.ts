import type { Code } from '../../types';
import { newLine } from './index';

export function* generateIntersectMerge(codes: Code[]): Generator<Code> {
	yield codes[0]!;
	for (let i = 1; i < codes.length; i++) {
		yield ` & `;
		yield codes[i]!;
	}
}

export function* generateSpreadMerge(codes: Code[]): Generator<Code> {
	if (codes.length === 1) {
		yield codes[0]!;
	}
	else {
		yield `{${newLine}`;
		for (const code of codes) {
			yield `...`;
			yield code;
			yield `,${newLine}`;
		}
		yield `}`;
	}
}
