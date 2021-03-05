import type { TsApiRegisterOptions } from '../types';
import type { Range } from 'vscode-languageserver/node';
import type { CodeActionContext } from 'vscode-languageserver/node';
import type { CodeAction } from 'vscode-languageserver/node';
import { tsEditToVueEdit } from './rename';

export function register({ mapper }: TsApiRegisterOptions) {

	return (uri: string, range: Range, context: CodeActionContext) => {

		const tsResult = onTs(uri, range, context);

		return tsResult;
	}

	function onTs(uri: string, range: Range, context: CodeActionContext) {

		const result: CodeAction[] = [];

		for (const tsRange of mapper.ts.to(uri, range.start, range.end)) {

			if (!tsRange.data.capabilities.diagnostic)
				continue;

			const tsCodeActions = tsRange.languageService.getCodeActions(tsRange.textDocument.uri, tsRange, context);
			if (!tsCodeActions)
				continue;

			for (const tsCodeAction of tsCodeActions) {
				if (tsCodeAction.title.indexOf('__VLS_') >= 0) continue

				const edit = tsCodeAction.edit ? tsEditToVueEdit(tsCodeAction.edit, mapper) : undefined;
				if (tsCodeAction.edit?.documentChanges?.length && !edit?.documentChanges?.length) continue;

				result.push({
					...tsCodeAction,
					edit,
				});
			}
		}

		return result;
	}
}
