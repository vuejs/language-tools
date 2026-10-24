import type { Code } from '../../types';

/** The parts map only as part of the enclosing boundary. */
export function* generateEscaped(
	text: string,
	source: string,
	offset: number,
	escapeTarget: RegExp,
): Generator<Code> {
	const parts = text.split(escapeTarget);
	let isEscapeTarget = false;

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i]!;
		if (isEscapeTarget) {
			yield `\\`;
		}
		yield [part, source, offset, undefined];
		offset += part.length;
		isEscapeTarget = !isEscapeTarget;
	}
}
