import { VueVirtualCode } from '@vue/language-core';
import type { RequestContext } from './types';
import { getSelfComponentName, getVariableType } from './utils';

export function getComponentNames(
	this: RequestContext,
	fileName: string,
): string[] {
	const { typescript: ts, language, languageService } = this;

	const sourceScript = language.scripts.get(fileName);
	const root = sourceScript?.generated?.root;
	if (!sourceScript?.generated || !(root instanceof VueVirtualCode)) {
		return [];
	}

	const names = getVariableType(ts, languageService, root, '__VLS_components')
		?.type
		?.getProperties()
		.map(c => c.name)
		.filter(entry => !entry.includes('$') && !entry.startsWith('_'))
		?? [];

	names.push(getSelfComponentName(fileName));
	return names;
}
