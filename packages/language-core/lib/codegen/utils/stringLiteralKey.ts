import type { Code, VueCodeInformation } from '../../types';
import { endBoundary, startBoundary } from './boundary';

export function* generateStringLiteralKey(code: string, offset?: number, info?: VueCodeInformation): Generator<Code> {
	if (offset === undefined || !info) {
		yield `'${code}'`;
	}
	else {
		const token = yield* startBoundary('template', offset, info);
		yield `'`;
		yield [code, 'template', offset, { __combineToken: token }];
		yield `'`;
		yield endBoundary(token, offset + code.length);
	}
}
