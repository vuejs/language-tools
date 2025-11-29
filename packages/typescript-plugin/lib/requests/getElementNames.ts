import { names } from '@vue/language-core';
import type * as ts from 'typescript';

export function getElementNames(
	ts: typeof import('typescript'),
	program: ts.Program,
): string[] {
	const checker = program.getTypeChecker();
	const elements = checker.resolveName(names.intrinsics, undefined, ts.SymbolFlags.Variable, false);
	if (!elements) {
		return [];
	}

	return checker.getTypeOfSymbol(elements).getProperties().map(c => c.name);
}
