import type { LanguageServiceRuntimeContext } from '../types';
import type { CodeAction } from 'vscode-languageserver-protocol';
import { tsEditToVueEdit } from './rename';
import { Data } from './codeAction';

export function register({ vueDocuments: sourceFiles, getTsLs }: LanguageServiceRuntimeContext) {
	return async (codeAction: CodeAction) => {
		const data: Data = codeAction.data as any;
		const tsCodeAction: CodeAction = {
			...codeAction,
			data: data.tsData,
		};
		codeAction = await getTsLs(data.lsType).doCodeActionResolve(tsCodeAction);
		if (codeAction.edit) {
			codeAction.edit = tsEditToVueEdit(data.lsType, false, codeAction.edit, sourceFiles, () => true);
		}
		return codeAction;
	}
}
