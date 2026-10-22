import type { Checker, Type } from 'typescript-7/async' with { 'resolution-mode': 'import' };

export async function inferComponentType(componentType: Type) {
	if ((await componentType.getConstructSignatures()).length) {
		return 1;
	}
	if ((await componentType.getCallSignatures()).length) {
		return 2;
	}
}

export async function inferComponentProps(
	checker: Checker,
	componentType: Type,
): Promise<Type | undefined> {
	for (const sig of await componentType.getConstructSignatures()) {
		const props = await findProperty(checker, await sig.getReturnType(), '$props');
		if (props) {
			return props;
		}
	}

	for (const sig of await componentType.getCallSignatures()) {
		const [props] = await sig.getParameters();
		if (props) {
			return await checker.getTypeOfSymbol(props);
		}
	}
}

export async function inferComponentSlots(
	checker: Checker,
	componentType: Type,
): Promise<Type | undefined> {
	for (const sig of await componentType.getConstructSignatures()) {
		const slots = await findProperty(checker, await sig.getReturnType(), '$slots');
		if (slots) {
			return slots;
		}
	}

	for (const sig of await componentType.getCallSignatures()) {
		const ctxParam = (await sig.getParameters())[1];
		if (ctxParam) {
			const slots = await findProperty(checker, await checker.getTypeOfSymbol(ctxParam), 'slots');
			if (slots) {
				return slots;
			}
		}
	}
}

export async function inferComponentEmit(
	checker: Checker,
	componentType: Type,
): Promise<Type | undefined> {
	for (const sig of await componentType.getConstructSignatures()) {
		const emit = await findProperty(checker, await sig.getReturnType(), '$emit');
		if (emit) {
			return emit;
		}
	}

	for (const sig of await componentType.getCallSignatures()) {
		const ctxParam = (await sig.getParameters())[1];
		if (ctxParam) {
			const emit = await findProperty(checker, await checker.getTypeOfSymbol(ctxParam), 'emit');
			if (emit) {
				return emit;
			}
		}
	}
}

export async function inferComponentExposed(
	checker: Checker,
	componentType: Type,
): Promise<Type | undefined> {
	for (const sig of await componentType.getConstructSignatures()) {
		return await sig.getReturnType();
	}

	for (const sig of await componentType.getCallSignatures()) {
		const exposeParam = (await sig.getParameters())[2];
		if (exposeParam) {
			const exposeType = await checker.getTypeOfSymbol(exposeParam);
			for (const callSig of await exposeType.getCallSignatures()) {
				const [param] = await callSig.getParameters();
				if (param) {
					return await checker.getTypeOfSymbol(param);
				}
			}
		}
	}
}

async function findProperty(
	checker: Checker,
	type: Type,
	property: string,
): Promise<Type | undefined> {
	const symbol = await type.getProperty(property);
	if (symbol) {
		return await checker.getTypeOfSymbol(symbol);
	}
	if (type.isUnionType() || type.isIntersectionType()) {
		for (const sub of await type.getTypes() ?? []) {
			const found = await findProperty(checker, sub, property);
			if (found) {
				return found;
			}
		}
	}
}
