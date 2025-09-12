import type * as ts from 'typescript';
import { getVariableType } from './utils';

export function getElementNames(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
): string[] {
	return getVariableType(ts, program, fileName, '__VLS_elements')
		?.type
		.getProperties()
		.map(c => c.name)
		?? [];
}
