import { names } from '@vue/language-core';
import type * as ts from 'typescript';
import type { ComponentPropInfo } from './getComponentProps';
import { booleanExceptionProps, getVariableType, hasBooleanType } from './utils';

export function getElementAttrs(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
	tag: string,
): ComponentPropInfo[] {
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

	return checker.getTypeOfSymbol(elementType).getProperties().map(prop => {
		const info: ComponentPropInfo = {
			name: prop.name,
		};
		if (!booleanExceptionProps.has(prop.name) && hasBooleanType(ts, checker.getTypeOfSymbol(prop))) {
			info.boolean = true;
		}
		return info;
	});
}
