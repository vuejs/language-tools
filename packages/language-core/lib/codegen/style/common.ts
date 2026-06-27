import type { Code, IRStyle, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { newLine } from '../utils';
import { Boundary } from '../utils/boundary';

export function* generateClassProperty(
	source: string,
	classNameWithDot: string,
	offset: number,
	propertyType: string,
): Generator<Code> {
	yield `${newLine} & { `;
	const boundary = yield* Boundary.start(source, offset, codeFeatures.navigation);
	yield `'`;
	yield [classNameWithDot.slice(1), source, offset + 1, boundary.features];
	yield `'`;
	yield boundary.end(offset + classNameWithDot.length);
	yield `: ${propertyType}`;
	yield ` }`;
}

export function* generateStyleImports(style: IRStyle): Generator<Code> {
	const features: VueCodeInformation = {
		navigation: true,
		verification: true,
	};
	if (typeof style.src === 'object') {
		yield `${newLine} & typeof import(`;
		const boundary = yield* Boundary.start('main', style.src.offset, features);
		yield `'`;
		yield [style.src.text, 'main', style.src.offset, boundary.features];
		yield `'`;
		yield boundary.end(style.src.offset + style.src.text.length);
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
