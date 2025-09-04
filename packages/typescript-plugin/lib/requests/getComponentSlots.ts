import { tsCodegen, type VueVirtualCode } from '@vue/language-core';
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

	const assignName = codegen.getSetupSlotsAssignName() ?? `__VLS_slots`;
	const slots = getVariableType(ts, program, virtualCode.fileName, assignName);
	if (!slots) {
		return [];
	}

	return slots.type.getProperties().map(({ name }) => name);
}
