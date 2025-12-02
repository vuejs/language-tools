import type { VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import { getComponentType } from './utils';

export function getComponentEvents(
	ts: typeof import('typescript'),
	program: ts.Program,
	virtualCode: VueVirtualCode,
	tag: string,
): string[] {
	const sourceFile = program.getSourceFile(virtualCode.fileName);
	if (!sourceFile) {
		return [];
	}

	const checker = program.getTypeChecker();
	const componentType = getComponentType(ts, checker, sourceFile, virtualCode, tag);
	if (!componentType) {
		return [];
	}

	const result = new Set<string>();

	// for (const sig of componentType.getCallSignatures()) {
	// 	const emitParam = sig.parameters[1];
	// 	if (emitParam) {
	// 		// TODO
	// 	}
	// }

	for (const sig of componentType.type.getConstructSignatures()) {
		const instanceType = sig.getReturnType();
		const emitSymbol = instanceType.getProperty('$emit');
		if (emitSymbol) {
			const emitType = checker.getTypeOfSymbolAtLocation(emitSymbol, componentType.node);
			for (const call of emitType.getCallSignatures()) {
				if (call.parameters.length) {
					const eventNameParamSymbol = call.parameters[0]!;
					const eventNameParamType = checker.getTypeOfSymbolAtLocation(eventNameParamSymbol, componentType.node);
					if (eventNameParamType.isStringLiteral()) {
						result.add(eventNameParamType.value);
					}
				}
			}
		}
	}

	return [...result];
}
