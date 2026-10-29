import type { Code, VueCodeInformation } from '../../types';

export function* generateEscaped(
	text: string,
	source: string,
	offset: number,
	features: VueCodeInformation,
	escapeTarget: RegExp,
): Generator<Code> {
	const parts = text.split(escapeTarget);
	if (!features.__combineToken) {
		features = { ...features, __combineToken: Symbol() };
	}
	let isEscapeTarget = false;

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i]!;
		if (isEscapeTarget) {
			yield `\\`;
		}
		yield [part, source, offset, features];
		offset += part.length;
		isEscapeTarget = !isEscapeTarget;
	}
}
