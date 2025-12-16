import type * as ts from 'typescript';

export function inferComponentType(
	typeChecker: ts.TypeChecker,
	symbolNode: ts.Node,
) {
	const componentType = typeChecker.getTypeAtLocation(symbolNode);
	const constructSignatures = componentType.getConstructSignatures();
	const callSignatures = componentType.getCallSignatures();

	for (const _sig of constructSignatures) {
		return 1;
	}

	for (const _sig of callSignatures) {
		return 2;
	}
}

export function inferComponentProps(
	typeChecker: ts.TypeChecker,
	symbolNode: ts.Node,
): ts.Type | undefined {
	const componentType = typeChecker.getTypeAtLocation(symbolNode);
	const constructSignatures = componentType.getConstructSignatures();
	const callSignatures = componentType.getCallSignatures();

	for (const sig of constructSignatures) {
		const retType = sig.getReturnType();
		const props = findProperty(typeChecker, symbolNode, retType, '$props');
		if (props) {
			return props;
		}
	}

	for (const sig of callSignatures) {
		if (sig.parameters.length > 0) {
			const props = sig.parameters[0];
			if (props) {
				return typeChecker.getTypeOfSymbolAtLocation(props, symbolNode);
			}
		}
	}
}

export function inferComponentSlots(
	typeChecker: ts.TypeChecker,
	symbolNode: ts.Node,
): ts.Type | undefined {
	const componentType = typeChecker.getTypeAtLocation(symbolNode);
	const constructSignatures = componentType.getConstructSignatures();
	const callSignatures = componentType.getCallSignatures();

	for (const sig of constructSignatures) {
		const retType = sig.getReturnType();
		const slots = findProperty(typeChecker, symbolNode, retType, '$slots');
		if (slots) {
			return slots;
		}
	}

	for (const sig of callSignatures) {
		if (sig.parameters.length > 1) {
			const ctxParam = sig.parameters[1];
			if (ctxParam) {
				const ctxType = typeChecker.getTypeOfSymbolAtLocation(ctxParam, symbolNode);
				const slots = findProperty(typeChecker, symbolNode, ctxType, 'slots');
				if (slots) {
					return slots;
				}
			}
		}
	}
}

export function inferComponentEmit(
	typeChecker: ts.TypeChecker,
	symbolNode: ts.Node,
): ts.Type | undefined {
	const componentType = typeChecker.getTypeAtLocation(symbolNode);
	const constructSignatures = componentType.getConstructSignatures();
	const callSignatures = componentType.getCallSignatures();

	for (const sig of constructSignatures) {
		const retType = sig.getReturnType();
		const emit = findProperty(typeChecker, symbolNode, retType, '$emit');
		if (emit) {
			return emit;
		}
	}

	for (const sig of callSignatures) {
		if (sig.parameters.length > 1) {
			const ctxParam = sig.parameters[1];
			if (ctxParam) {
				const ctxType = typeChecker.getTypeOfSymbolAtLocation(ctxParam, symbolNode);
				const emitType = findProperty(typeChecker, symbolNode, ctxType, 'emit');
				if (emitType) {
					return emitType;
				}
			}
		}
	}
}

export function inferComponentExposed(
	typeChecker: ts.TypeChecker,
	symbolNode: ts.Node,
): ts.Type | undefined {
	const componentType = typeChecker.getTypeAtLocation(symbolNode);
	const constructSignatures = componentType.getConstructSignatures();
	const callSignatures = componentType.getCallSignatures();

	for (const sig of constructSignatures) {
		return sig.getReturnType();
	}

	for (const sig of callSignatures) {
		if (sig.parameters.length > 2) {
			const exposeParam = sig.parameters[2];
			if (exposeParam) {
				const exposeType = typeChecker.getTypeOfSymbolAtLocation(exposeParam, symbolNode);
				const callSignatures = exposeType.getCallSignatures();
				for (const callSig of callSignatures) {
					const params = callSig.getParameters();
					if (params.length > 0) {
						return typeChecker.getTypeOfSymbolAtLocation(params[0]!, symbolNode);
					}
				}
			}
		}
	}
}

function findProperty(
	typeChecker: ts.TypeChecker,
	location: ts.Node,
	type: ts.Type,
	property: string,
): ts.Type | undefined {
	const symbol = type.getProperty(property);
	if (symbol) {
		return typeChecker.getTypeOfSymbolAtLocation(symbol, location);
	}
	if (type.isUnionOrIntersection()) {
		for (const sub of type.types) {
			const found = findProperty(typeChecker, location, sub, property);
			if (found) {
				return found;
			}
		}
	}
}
