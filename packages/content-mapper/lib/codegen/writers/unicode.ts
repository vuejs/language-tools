import type { CodeSource, VueCodeMarker } from '@vue/language-core';
import { Boundary, mapped, type TsCode } from '../tsCode';

export function* generateUnicode(
	code: string,
	source: CodeSource,
	offset: number,
	features: VueCodeMarker,
): Generator<TsCode> {
	if (needToUnicode(code)) {
		const boundary = yield* Boundary.start(source, offset, offset + code.length, features);
		yield toUnicode(code);
		yield boundary.end();
	}
	else {
		yield mapped(code, source, offset, features);
	}
}

function needToUnicode(str: string) {
	return str.includes('\\') || str.includes('\n');
}

function toUnicode(str: string) {
	return str.split('').map(value => {
		const temp = value.charCodeAt(0).toString(16).padStart(4, '0');
		if (temp.length > 2) {
			return '\\u' + temp;
		}
		return value;
	}).join('');
}
