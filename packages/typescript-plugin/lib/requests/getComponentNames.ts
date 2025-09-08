import type * as ts from 'typescript';
import { getSelfComponentName, getVariableType } from './utils';

export function getComponentNames(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
): string[] {
	const names = getVariableType(ts, program, fileName, '__VLS_components')
		?.type
		.getProperties()
		.map(c => c.name)
		.filter(entry => !entry.includes('$') && !entry.startsWith('_'))
		?? [];
	names.push(getSelfComponentName(fileName));
	return names;
}
