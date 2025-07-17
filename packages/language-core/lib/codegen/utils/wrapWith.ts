import type { Code, VueCodeInformation } from '../../types';

export function wrapWith(
	startOffset: number,
	endOffset: number,
	features: VueCodeInformation,
	...codes: Code[]
): Generator<Code>;

export function wrapWith(
	startOffset: number,
	endOffset: number,
	source: string,
	features: VueCodeInformation,
	...codes: Code[]
): Generator<Code>;

export function* wrapWith(
	startOffset: number,
	endOffset: number,
	...args: any[]
): Generator<Code> {
	let source = 'template';
	let features: VueCodeInformation;
	let codes: Code[];
	if (typeof args[0] === 'string') {
		[source, features, ...codes] = args;
	}
	else {
		[features, ...codes] = args;
	}

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
