import type { VueCodeMarker } from '@vue/language-core';
import { Boundary, type TsCode } from '../tsCode';

export function* generateStringLiteralKey(
	code: string,
	offset: number,
	features: VueCodeMarker,
): Generator<TsCode> {
	const boundary = yield* Boundary.start('template', offset, offset + code.length, features);
	yield `'`;
	yield [code, 'template', offset, undefined];
	yield `'`;
	yield boundary.end();
}
