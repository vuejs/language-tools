import type { TsApiRegisterOptions } from '../types';
import type { CodeAction } from 'vscode-languageserver-types';
import { tsEditToVueEdit } from './rename';

export function register({ tsLanguageService, mapper }: TsApiRegisterOptions) {
	return (codeAction: CodeAction) => {
		codeAction = tsLanguageService.doCodeActionResolve(codeAction);
		if (codeAction.edit) {
			codeAction.edit = tsEditToVueEdit(codeAction.edit, mapper, () => true);
		}
		return codeAction;
	}
}
