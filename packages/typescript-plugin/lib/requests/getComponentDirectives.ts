import { VueVirtualCode } from '@vue/language-core';
import type { RequestContext } from './types';
import { getVariableType } from './utils';

export function getComponentDirectives(
	this: RequestContext,
	fileName: string
) {
	const { typescript: ts, language, languageService, getFileId } = this;
	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof VueVirtualCode)) {
		return;
	}
	const vueCode = volarFile.generated.root;
	const directives = getVariableType(ts, languageService, vueCode, '__VLS_directives');
	if (!directives) {
		return [];
	}

	return directives.type.getProperties()
		.map(({ name }) => name)
		.filter(name => name.startsWith('v') && name.length >= 2 && name[1] === name[1].toUpperCase())
		.filter(name => !['vBind', 'vIf', 'vOn', 'VOnce', 'vShow', 'VSlot'].includes(name));
}
