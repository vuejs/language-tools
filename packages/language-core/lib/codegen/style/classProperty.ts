import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { combineLastMapping, newLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';

export function* generateClassProperty(
	styleIndex: number,
	classNameWithDot: string,
	offset: number,
	propertyType: string
): Generator<Code> {
	yield `${newLine} & { `;
	yield* wrapWith(
		offset,
		offset + classNameWithDot.length,
		'style_' + styleIndex,
		codeFeatures.navigation,
		`'`,
		[
			classNameWithDot.slice(1),
			'style_' + styleIndex,
			offset + 1,
			combineLastMapping
		],
		`'`
	);
	yield `: ${propertyType}`;
	yield ` }`;
}
