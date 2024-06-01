import type { Code, VueCodeInformation } from '../../types';
import { combineLastMapping, wrapWith } from '../common';

export function* generateStringLiteralKey(code: string, offset?: number, info?: VueCodeInformation): Generator<Code> {
	if (offset === undefined || !info) {
		yield `"${code}"`;
	}
	else {
		yield* wrapWith(
			offset,
			offset + code.length,
			info,
			`"`,
			[code, 'template', offset, combineLastMapping],
			`"`
		);
	}
}
