import type { CodeSource, VueCodeMarker } from '@vue/language-core';
import { Boundary, mapped, type TsCode } from '../tsCode';

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
