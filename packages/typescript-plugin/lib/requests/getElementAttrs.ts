import type * as ts from 'typescript';
import { getVariableType } from './utils';

export function getElementAttrs(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
	tag: string,
): string[] {
	const checker = program.getTypeChecker();
	const elements = getVariableType(ts, program, fileName, '__VLS_elements');
	if (!elements) {
		return [];
	}

	const elementType = elements.type.getProperty(tag);
	if (!elementType) {
		return [];
	}

	const attrs = checker.getTypeOfSymbol(elementType).getProperties();
	return attrs.map(c => c.name);
}
