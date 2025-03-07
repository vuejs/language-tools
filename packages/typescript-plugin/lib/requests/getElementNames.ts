import { VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import type { RequestContext } from './types';
import { getVariableType } from './utils';

export function getElementNames(
	this: RequestContext,
	fileName: string
) {
	const { typescript: ts, language, languageService, getFileId } = this;
	const volarFile = language.scripts.get(getFileId(fileName));
	if (!(volarFile?.generated?.root instanceof VueVirtualCode)) {
		return;
	}
	const vueCode = volarFile.generated.root;
	return _getElementNames(ts, languageService, vueCode);
}

export function _getElementNames(
	ts: typeof import('typescript'),
	tsLs: ts.LanguageService,
	vueCode: VueVirtualCode
) {
	return getVariableType(ts, tsLs, vueCode, '__VLS_elements')
		?.type
		?.getProperties()
		.map(c => c.name)
		?? [];
}
