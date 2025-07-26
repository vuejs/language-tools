import { VueVirtualCode } from '@vue/language-core';
import type { RequestContext } from './types';
import { getSelfComponentName, getVariableType } from './utils';

export function getComponentNames(
	this: RequestContext,
	fileName: string,
) {
	const { typescript: ts, language, languageService } = this;
	const volarFile = language.scripts.get(fileName);
	if (!(volarFile?.generated?.root instanceof VueVirtualCode)) {
		return;
	}
	const vueCode = volarFile.generated.root;
	const names = getVariableType(ts, languageService, vueCode, '__VLS_components')
		?.type
		?.getProperties()
		.map(c => c.name)
		.filter(entry => !entry.includes('$') && !entry.startsWith('_'))
		?? [];

	names.push(getSelfComponentName(vueCode.fileName));
	return names;
}
