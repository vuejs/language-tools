import { capitalize } from '@vue/shared';
import type { Code, VueCodeMarker } from '../../types';
import { toAtomGroup } from '../codeFeatures';

export function* generateCamelized(
	code: string,
	source: string,
	offset: number,
	features: VueCodeMarker,
): Generator<Code> {
	const parts = code.split('-');
	if (!features.atom) {
		features = toAtomGroup(features);
	}

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i]!;
		if (part !== '') {
			if (i === 0) {
				yield [part, source, offset, features];
			}
			else {
				yield [capitalize(part), source, offset, features];
			}
		}
		offset += part.length + 1;
	}
}
