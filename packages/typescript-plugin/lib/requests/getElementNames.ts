import { names } from '@vue/language-core';
import type * as ts from 'typescript';
import { getVariableType } from './utils';

export function getElementNames(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
): string[] {
	const sourceFile = program.getSourceFile(fileName);
	if (!sourceFile) {
		return [];
	}

	const checker = program.getTypeChecker();
	const elements = getVariableType(ts, checker, sourceFile, names.intrinsics);
	if (!elements) {
		return [];
	}

	return elements.type.getProperties().map(c => c.name);
}
