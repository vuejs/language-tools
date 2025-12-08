import type { Code, VueCodeInformation } from '../../types';

export function* startBoundary(
	source: string,
	startOffset: number,
	features: VueCodeInformation,
) {
	const token = Symbol(source);
	yield ['', source, startOffset, { ...features, __combineToken: token }] as Code;
	return token;
}

export function endBoundary(token: symbol, endOffset: number) {
	return ['', token.description, endOffset, { __combineToken: token }] as Code;
}
