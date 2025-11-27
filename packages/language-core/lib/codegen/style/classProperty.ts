import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';

export function* generateClassProperty(
	styleIndex: number,
	classNameWithDot: string,
	offset: number,
	propertyType: string,
): Generator<Code> {
	yield `${newLine} & { `;
	const source = 'style_' + styleIndex;
	const token = yield* startBoundary(source, offset, codeFeatures.navigation);
	yield `'`;
	yield [classNameWithDot.slice(1), source, offset + 1, { __combineToken: token }];
	yield `'`;
	yield endBoundary(token, offset + classNameWithDot.length);
	yield `: ${propertyType}`;
	yield ` }`;
}
