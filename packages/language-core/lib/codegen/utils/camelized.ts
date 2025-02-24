import { capitalize } from '@vue/shared';
import type { Code, VueCodeInformation } from '../../types';

export function* generateCamelized(code: string, offset: number, info: VueCodeInformation): Generator<Code> {
	const parts = code.split('-');
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (part !== '') {
			if (i === 0) {
				yield [
					part,
					'template',
					offset,
					info,
				];
			}
			else {
				yield [
					capitalize(part),
					'template',
					offset,
					{ __combineOffset: i },
				];
			}
		}
		offset += part.length + 1;
	}
}
