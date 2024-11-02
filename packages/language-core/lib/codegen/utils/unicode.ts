import type { Code, VueCodeInformation } from '../../types';
import { wrapWith } from './index';

export function* generateUnicode(code: string, offset: number, info: VueCodeInformation): Generator<Code> {
	if (needToUnicode(code)) {
		yield* wrapWith(
			offset,
			offset + code.length,
			info,
			toUnicode(code)
		);
	}
	else {
		yield [code, 'template', offset, info];
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
