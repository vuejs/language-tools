import type { Code, VueCodeInformation } from '../../types';
import { Boundary } from './boundary';

export function* generateStringLiteralKey(
	code: string,
	offset: number,
	features: VueCodeInformation,
): Generator<Code> {
	const boundary = yield* Boundary.start('template', offset, offset + code.length, features);
	yield `'`;
	yield [code, 'template', offset, boundary.features];
	yield `'`;
	yield boundary.end();
}
