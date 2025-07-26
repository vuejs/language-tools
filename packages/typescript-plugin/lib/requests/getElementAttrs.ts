import { VueVirtualCode } from '@vue/language-core';
import type { RequestContext } from './types';
import { getVariableType } from './utils';

export function getElementAttrs(
	this: RequestContext,
	fileName: string,
	tagName: string,
) {
	const { typescript: ts, language, languageService } = this;

	const sourceScript = language.scripts.get(fileName);
	const root = sourceScript?.generated?.root;
	if (!sourceScript?.generated || !(root instanceof VueVirtualCode)) {
		return [];
	}

	const program = languageService.getProgram()!;
	const checker = program.getTypeChecker();
	const elements = getVariableType(ts, languageService, root, '__VLS_elements');
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
