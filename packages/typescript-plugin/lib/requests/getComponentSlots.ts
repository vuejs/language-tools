import { tsCodegen, VueVirtualCode } from '@vue/language-core';
import type { RequestContext } from './types';
import { getVariableType } from './utils';

export function getComponentSlots(
	this: RequestContext,
	fileName: string,
): string[] {
	const { typescript: ts, language, languageService } = this;

	const sourceScript = language.scripts.get(fileName);
	const root = sourceScript?.generated?.root;
	if (!sourceScript?.generated || !(root instanceof VueVirtualCode)) {
		return [];
	}

	const codegen = tsCodegen.get(root.sfc);
	if (!codegen) {
		return [];
	}

	const assignName = codegen.getSetupSlotsAssignName() ?? `__VLS_slots`;
	const slots = getVariableType(ts, languageService, root, assignName);
	if (!slots) {
		return [];
	}

	return slots.type.getProperties().map(({ name }) => name);
}
