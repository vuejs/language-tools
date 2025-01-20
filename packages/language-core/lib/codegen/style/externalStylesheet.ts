import { Code, Sfc } from '../../types';
import { codeFeatures } from '../script';
import { generateSfcBlockAttrValue, newLine } from '../utils';

export function* generateExternalStylesheets(
	style: Sfc['styles'][number],
): Generator<Code> {
	if (typeof style.src === 'object') {
		yield `${newLine} & typeof import(`;
		yield* generateSfcBlockAttrValue(style.src, style.src.text, codeFeatures.navigation);
		yield `).default`;
	}
	for (const { text, offset } of style.imports) {
		yield `${newLine} & typeof import('`;
		yield [
			text,
			style.name,
			offset,
			codeFeatures.navigation
		];
		yield `').default`;
	}
}
