import type { ApiLanguageServiceContext } from '../types';
import type { CodeAction } from 'vscode-languageserver-types';
import { tsEditToVueEdit } from './rename';
import type { Data } from './callHierarchy';

export function register({ sourceFiles, getTsLs }: ApiLanguageServiceContext) {
	return async (codeAction: CodeAction) => {
		const data: Data = codeAction.data as any;
		codeAction = await getTsLs(data.lsType).doCodeActionResolve(codeAction);
		if (codeAction.edit) {
			codeAction.edit = tsEditToVueEdit(data.lsType, codeAction.edit, sourceFiles, () => true);
		}
		return codeAction;
	}
}
