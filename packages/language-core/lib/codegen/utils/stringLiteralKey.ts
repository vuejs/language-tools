import type { Code, VueCodeInformation } from '../../types';
import { Boundary } from './boundary';

export function* generateStringLiteralKey(code: string, offset?: number, info?: VueCodeInformation): Generator<Code> {
	if (offset === undefined || !info) {
		yield `'${code}'`;
	}
	else {
		const boundary = yield* Boundary.start('template', offset, info);
		yield `'`;
		yield [code, 'template', offset, boundary.features];
		yield `'`;
		yield boundary.end(offset + code.length);
	}
}
