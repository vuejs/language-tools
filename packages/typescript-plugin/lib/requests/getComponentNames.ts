import { VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import type { RequestContext } from './types';
import { getSelfComponentName, getVariableType } from './utils';

export function getComponentNames(
	this: RequestContext,
	fileName: string
) {
	const { typescript: ts, language, languageService, getFileId } = this;
	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof VueVirtualCode)) {
		return;
	}
	const vueCode = volarFile.generated.root;
	return _getComponentNames(ts, languageService, vueCode);
}

export function _getComponentNames(
	ts: typeof import('typescript'),
	tsLs: ts.LanguageService,
	vueCode: VueVirtualCode
) {
	const names = getVariableType(ts, tsLs, vueCode, '__VLS_components')
		?.type
		?.getProperties()
		.map(c => c.name)
		.filter(entry => !entry.includes('$') && !entry.startsWith('_'))
		?? [];

	names.push(getSelfComponentName(vueCode.fileName));
	return names;
}
