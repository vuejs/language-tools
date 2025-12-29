import { names } from '@vue/language-core';
import type * as ts from 'typescript';
import { getComponentMeta as _get } from 'vue-component-meta/lib/componentMeta';
import { getVariableType } from './utils';

export function getElementAttrs(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
	tag: string,
) {
	const sourceFile = program.getSourceFile(fileName);
	if (!sourceFile) {
		return [];
	}

	const checker = program.getTypeChecker();
	const elements = getVariableType(ts, checker, sourceFile, names.intrinsics);
	if (!elements) {
		return [];
	}

	const elementType = elements.type.getProperty(tag);
	if (!elementType) {
		return [];
	}

	return checker.getTypeOfSymbol(elementType).getProperties().map(c => ({
		name: c.name,
		type: checker.typeToString(
			checker.getTypeOfSymbolAtLocation(c, sourceFile),
			elements.node,
			ts.TypeFormatFlags.NoTruncation,
		),
	}));
}
