import { names, tsCodegen, type VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import { getSelfComponentName, getVariableType } from './utils';

export function getComponentNames(
	ts: typeof import('typescript'),
	program: ts.Program,
	{ fileName, sfc }: VueVirtualCode,
): string[] {
	const sourceFile = program.getSourceFile(fileName);
	if (!sourceFile) {
		return [];
	}

	const checker = program.getTypeChecker();
	const componentNames = getVariableType(ts, checker, sourceFile, names.components)
		?.type
		.getProperties()
		.map(c => c.name)
		.filter(entry => !entry.includes('$') && !entry.startsWith('_'))
		?? [];

	componentNames.push(getSelfComponentName(fileName));
	componentNames.push(...tsCodegen.get(sfc)?.getImportedComponents() ?? []);

	return [...new Set(componentNames)];
}
