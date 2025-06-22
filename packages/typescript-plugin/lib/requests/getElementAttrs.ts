import { VueVirtualCode } from '@vue/language-core';
import type { RequestContext } from './types';
import { getVariableType } from './utils';

export function getElementAttrs(
	this: RequestContext,
	fileName: string,
	tagName: string,
) {
	const { typescript: ts, language, languageService, asScriptId } = this;
	const volarFile = language.scripts.get(asScriptId(fileName));
	if (!(volarFile?.generated?.root instanceof VueVirtualCode)) {
		return;
	}
	const vueCode = volarFile.generated.root;

	const program = languageService.getProgram()!;
	const checker = program.getTypeChecker();
	const elements = getVariableType(ts, languageService, vueCode, '__VLS_elements');
	if (!elements) {
		return [];
	}

	const elementType = elements.type.getProperty(tagName);
	if (!elementType) {
		return [];
	}

	const attrs = checker.getTypeOfSymbol(elementType).getProperties();
	return attrs.map(c => c.name);
}
