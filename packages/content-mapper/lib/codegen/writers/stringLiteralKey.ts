import type { CodeSource, VueCodeMarker } from '@vue/language-core';
import { Boundary, mapped, type TsCode } from '../tsCode';
import { identifierRE } from './index';

/** `code` at `offset` of `source` as the key of an object type or literal: as it is if an identifier, else quoted. */
export function* generatePropertyKey(
	code: string,
	source: CodeSource,
	offset: number,
	features: VueCodeMarker,
): Generator<TsCode> {
	if (identifierRE.test(code)) {
		yield mapped(code, source, offset, features);
	}
	else {
		yield* generateStringLiteralKey(code, source, offset, features);
	}
}

export function* generateStringLiteralKey(
	code: string,
	source: CodeSource,
	offset: number,
	features: VueCodeMarker,
): Generator<TsCode> {
	const boundary = yield* Boundary.start(source, offset, offset + code.length, features);
	yield `'`;
	yield mapped(code, source, offset, undefined);
	yield `'`;
	yield boundary.end();
}
