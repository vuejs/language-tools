import { names } from '@vue/language-core';
import type * as ts from 'typescript';
import { getVariableType } from './utils';

export function getComponentDirectives(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
): string[] {
	const sourceFile = program.getSourceFile(fileName);
	if (!sourceFile) {
		return [];
	}

	const checker = program.getTypeChecker();
	const directives = getVariableType(ts, checker, sourceFile, names.directives);
	if (!directives) {
		return [];
	}

	return directives.type.getProperties()
		.map(({ name }) => name)
		.filter(name => name.match(/^v[A-Z]/));
}
