import type { Code, Sfc, VueCodeInformation } from '../../types';
import { newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';

export function* generateStyleImports(
	style: Sfc['styles'][number],
): Generator<Code> {
	const features: VueCodeInformation = {
		navigation: true,
		verification: true,
	};
	if (typeof style.src === 'object') {
		yield `${newLine} & typeof import(`;
		const token = yield* startBoundary('main', style.src.offset, features);
		yield `'`;
		yield [style.src.text, 'main', style.src.offset, { __combineToken: token }];
		yield `'`;
		yield endBoundary(token, style.src.offset + style.src.text.length);
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
