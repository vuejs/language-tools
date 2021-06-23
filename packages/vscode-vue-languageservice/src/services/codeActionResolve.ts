import type { ApiLanguageServiceContext } from '../types';
import type { CodeAction } from 'vscode-languageserver-types';
import { tsEditToVueEdit } from './rename';

export function register({ tsLs, mapper }: ApiLanguageServiceContext) {
	return (codeAction: CodeAction) => {
		codeAction = tsLs.doCodeActionResolve(codeAction);
		if (codeAction.edit) {
			codeAction.edit = tsEditToVueEdit(codeAction.edit, mapper, () => true);
		}
		return codeAction;
	}
}
