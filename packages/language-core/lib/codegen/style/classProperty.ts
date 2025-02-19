import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { newLine } from '../utils';

export function* generateClassProperty(
	styleIndex: number,
	classNameWithDot: string,
	offset: number,
	propertyType: string
): Generator<Code> {
	yield `${newLine} & { `;
	yield [
		'',
		'style_' + styleIndex,
		offset,
		codeFeatures.navigation,
	];
	yield `'`;
	yield [
		classNameWithDot.slice(1),
		'style_' + styleIndex,
		offset + 1,
		codeFeatures.navigation,
	];
	yield `'`;
	yield [
		'',
		'style_' + styleIndex,
		offset + classNameWithDot.length,
		codeFeatures.navigation,
	];
	yield `: ${propertyType}`;
	yield ` }`;
}
