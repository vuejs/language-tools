import { capitalize } from '@vue/shared';
import type { Code, VueCodeInformation } from '../../types';

export function* generateCamelized(
	code: string,
	source: string,
	offset: number,
	features: VueCodeInformation,
): Generator<Code> {
	const parts = code.split('-');
	const combineToken = features.__combineToken ?? Symbol();

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i]!;
		if (part !== '') {
			if (i === 0) {
				yield [
					part,
					source,
					offset,
					{ ...features, __combineToken: combineToken },
				];
			}
			else {
				yield [
					capitalize(part),
					source,
					offset,
					{ __combineToken: combineToken },
				];
			}
		}
		offset += part.length + 1;
	}
}
