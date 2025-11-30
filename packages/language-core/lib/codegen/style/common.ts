import type { Code, Sfc, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';

export function* generateClassProperty(
	source: string,
	classNameWithDot: string,
	offset: number,
	propertyType: string,
): Generator<Code> {
	yield `${newLine} & { `;
	const token = yield* startBoundary(source, offset, codeFeatures.navigation);
	yield `'`;
	yield [classNameWithDot.slice(1), source, offset + 1, { __combineToken: token }];
	yield `'`;
	yield endBoundary(token, offset + classNameWithDot.length);
	yield `: ${propertyType}`;
	yield ` }`;
}

export function* generateStyleImports(style: Sfc['styles'][number]): Generator<Code> {
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
