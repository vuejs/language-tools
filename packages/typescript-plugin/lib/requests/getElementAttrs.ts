import type * as ts from 'typescript';

export function getElementAttrs(
	ts: typeof import('typescript'),
	program: ts.Program,
	tag: string,
): string[] {
	const checker = program.getTypeChecker();
	const elements = checker.resolveName('__VLS_elements', undefined, ts.SymbolFlags.Variable, false);
	if (!elements) {
		return [];
	}

	const elementType = checker.getTypeOfSymbol(elements).getProperty(tag);
	if (!elementType) {
		return [];
	}

	return checker.getTypeOfSymbol(elementType).getProperties().map(c => c.name);
}
