import type { Code, VueCodeMarker } from '@vue/language-core';
import { Boundary } from '@vue/language-core/lib/utils/boundary';
import { capitalize } from '@vue/shared';

/** Without features, the parts map only as part of the enclosing boundary. */
export function* generateCamelized(
	code: string,
	source: string,
	offset: number,
	features?: VueCodeMarker,
): Generator<Code> {
	const parts: [text: string, offset: number][] = [];
	for (const [i, part] of code.split('-').entries()) {
		if (part !== '') {
			parts.push([i === 0 ? part : capitalize(part), offset]);
		}
		offset += part.length + 1;
	}
	if (!features) {
		for (const [text, offset] of parts) {
			yield [text, source, offset, undefined];
		}
	}
	else if (parts.length > 1) {
		const [, start] = parts[0]!;
		const [lastText, lastOffset] = parts.at(-1)!;
		const boundary = yield* Boundary.start(source, start, lastOffset + lastText.length, features);
		for (const [text, offset] of parts) {
			yield [text, source, offset, undefined];
		}
		yield boundary.end();
	}
	else {
		for (const [text, offset] of parts) {
			yield [text, source, offset, features];
		}
	}
}
