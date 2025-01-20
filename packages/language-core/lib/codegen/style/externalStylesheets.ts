import type { Code, Sfc, VueCodeInformation } from '../../types';
import { generateSfcBlockAttrValue, newLine } from '../utils';

export function* generateExternalStylesheets(
	style: Sfc['styles'][number],
): Generator<Code> {
	const features: VueCodeInformation = {
		navigation: true,
		verification: true
	};
	if (typeof style.src === 'object') {
		yield `${newLine} & typeof import(`;
		yield* generateSfcBlockAttrValue(style.src, style.src.text, features);
		yield `).default`;
	}
	for (const { text, offset } of style.imports) {
		yield `${newLine} & typeof import('`;
		yield [
			text,
			style.name,
			offset,
			features
		];
		yield `').default`;
	}
}
