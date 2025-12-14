import { names, tsCodegen, type VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import { getVariableType } from './utils';

export function getComponentSlots(
	ts: typeof import('typescript'),
	program: ts.Program,
	virtualCode: VueVirtualCode,
): string[] {
	const codegen = tsCodegen.get(virtualCode.sfc);
	if (!codegen) {
		return [];
	}

	const sourceFile = program.getSourceFile(virtualCode.fileName);
	if (!sourceFile) {
		return [];
	}

	const checker = program.getTypeChecker();
	const assignName = codegen.getScriptSetupRanges()?.defineSlots?.name ?? names.slots;
	const slots = getVariableType(ts, checker, sourceFile, assignName);
	if (!slots) {
		return [];
	}

	return slots.type.getProperties().map(({ name }) => name);
}
