import { names } from '@vue/language-core';
import type * as ts from 'typescript';
import { getSelfComponentName, getVariableType } from './utils';

export function getComponentNames(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
): string[] {
	const componentNames = getVariableType(ts, program, fileName, names.components)
		?.type
		.getProperties()
		.map(c => c.name)
		.filter(entry => !entry.includes('$') && !entry.startsWith('_'))
		?? [];
	componentNames.push(getSelfComponentName(fileName));
	return componentNames;
}
