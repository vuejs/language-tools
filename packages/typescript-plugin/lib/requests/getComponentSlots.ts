import { tsCodegen, VueVirtualCode } from '@vue/language-core';
import type { RequestContext } from './types';
import { getVariableType } from './utils';

export function getComponentSlots(
	this: RequestContext,
	fileName: string,
) {
	const { typescript: ts, language, languageService, asScriptId } = this;
	const volarFile = language.scripts.get(asScriptId(fileName));
	if (!(volarFile?.generated?.root instanceof VueVirtualCode)) {
		return;
	}
	const vueCode = volarFile.generated.root;

	const codegen = tsCodegen.get(vueCode.sfc);
	if (!codegen) {
		return;
	}

	const assignName = codegen.getSetupSlotsAssignName() ?? `__VLS_slots`;
	const slots = getVariableType(ts, languageService, vueCode, assignName);
	if (!slots) {
		return [];
	}

	return slots.type.getProperties().map(({ name }) => name);
}
