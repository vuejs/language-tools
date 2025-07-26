import { VueVirtualCode } from '@vue/language-core';
import type { RequestContext } from './types';
import { getVariableType } from './utils';

const builtInDirectives = new Set([
	'vBind',
	'vIf',
	'vOn',
	'vOnce',
	'vShow',
	'vSlot',
]);

export function getComponentDirectives(
	this: RequestContext,
	fileName: string,
) {
	const { typescript: ts, language, languageService } = this;

	const sourceScript = language.scripts.get(fileName);
	const root = sourceScript?.generated?.root;
	if (!sourceScript?.generated || !(root instanceof VueVirtualCode)) {
		return [];
	}

	const directives = getVariableType(ts, languageService, root, '__VLS_directives');
	if (!directives) {
		return [];
	}

	return directives.type.getProperties()
		.map(({ name }) => name)
		.filter(name => name.startsWith('v') && name.length >= 2 && name[1] === name[1].toUpperCase())
		.filter(name => !builtInDirectives.has(name));
}
