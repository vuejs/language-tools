import type { Code, VueCodeMarker } from '@vue/language-core';
import { Boundary } from '@vue/language-core/lib/utils/boundary';

export function* generateStringLiteralKey(
	code: string,
	offset: number,
	features: VueCodeMarker,
): Generator<Code> {
	const boundary = yield* Boundary.start('template', offset, offset + code.length, features);
	yield `'`;
	yield [code, 'template', offset, undefined];
	yield `'`;
	yield boundary.end();
}
