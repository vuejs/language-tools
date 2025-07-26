import { VueVirtualCode } from '@vue/language-core';
import type { RequestContext } from './types';
import { getVariableType } from './utils';

export function getElementNames(
	this: RequestContext,
	fileName: string,
): string[] {
	const { typescript: ts, language, languageService } = this;

	const sourceScript = language.scripts.get(fileName);
	const root = sourceScript?.generated?.root;
	if (!sourceScript?.generated || !(root instanceof VueVirtualCode)) {
		return [];
	}

	return getVariableType(ts, languageService, root, '__VLS_elements')
		?.type
		?.getProperties()
		.map(c => c.name)
		?? [];
}
