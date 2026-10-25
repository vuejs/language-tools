import type { Code, VueCodeMarker } from '../../types';
import { Boundary } from '../../utils/boundary';

export function* generateUnicode(code: string, offset: number, features: VueCodeMarker): Generator<Code> {
	if (needToUnicode(code)) {
		const boundary = yield* Boundary.start('template', offset, offset + code.length, features);
		yield toUnicode(code);
		yield boundary.end();
	}
	else {
		yield [code, 'template', offset, features];
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
