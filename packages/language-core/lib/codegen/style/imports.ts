import type { Code, Sfc, VueCodeInformation } from '../../types';
import { combineLastMapping, newLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';

export function* generateStyleImports(
	style: Sfc['styles'][number],
): Generator<Code> {
	const features: VueCodeInformation = {
		navigation: true,
		verification: true,
	};
	if (typeof style.src === 'object') {
		yield `${newLine} & typeof import(`;
		yield* wrapWith(
			style.src.offset,
			style.src.offset + style.src.text.length,
			'main',
			features,
			`'`,
			[style.src.text, 'main', style.src.offset, combineLastMapping],
			`'`,
		);
		yield `).default`;
	}
	for (const { text, offset } of style.imports) {
		yield `${newLine} & typeof import('`;
		yield [
			text,
			style.name,
			offset,
			features,
		];
		yield `').default`;
	}
}
