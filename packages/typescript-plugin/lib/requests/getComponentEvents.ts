import type * as ts from 'typescript';
import { getComponentType, getVariableType } from './utils';

export function getComponentEvents(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
	tag: string,
): string[] {
	const checker = program.getTypeChecker();
	const components = getVariableType(ts, program, fileName, '__VLS_components');
	if (!components) {
		return [];
	}

	const componentType = getComponentType(ts, program, fileName, components, tag);
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

	for (const sig of componentType.getConstructSignatures()) {
		const instanceType = sig.getReturnType();
		const emitSymbol = instanceType.getProperty('$emit');
		if (emitSymbol) {
			const emitType = checker.getTypeOfSymbolAtLocation(emitSymbol, components.node);
			for (const call of emitType.getCallSignatures()) {
				if (call.parameters.length) {
					const eventNameParamSymbol = call.parameters[0]!;
					const eventNameParamType = checker.getTypeOfSymbolAtLocation(eventNameParamSymbol, components.node);
					if (eventNameParamType.isStringLiteral()) {
						result.add(eventNameParamType.value);
					}
				}
			}
		}
	}

	return [...result];
}
