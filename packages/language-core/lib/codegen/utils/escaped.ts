import type { Code, VueCodeInformation } from "../../types";

export function* generateEscaped(
	text: string,
	source: string,
	offset: number,
	features: VueCodeInformation,
	escapeTarget: RegExp
): Generator<Code> {
	const parts = text.split(escapeTarget);
	let isEscapeTarget = false;

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (isEscapeTarget) {
			yield `\\`;
		}
		yield [
			part,
			source,
			offset,
			i === 0 ? features : { __combineOffset: i },
		];
		offset += part.length;
		isEscapeTarget = !isEscapeTarget;
	}
}
