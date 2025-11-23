import type { Code, VueCodeInformation } from '../../types';

export function* wrapWith(
	source: string,
	startOffset: number,
	endOffset: number,
	features: VueCodeInformation,
	...codes: Code[]
): Generator<Code> {
	yield ['', source, startOffset, features];
	let offset = 1;
	for (const code of codes) {
		if (typeof code !== 'string') {
			offset++;
		}
		yield code;
	}
	yield ['', source, endOffset, { __combineOffset: offset }];
}
