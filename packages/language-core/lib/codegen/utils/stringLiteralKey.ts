import type { Code, VueCodeMarker } from '../../types';
import { Boundary } from './boundary';

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
