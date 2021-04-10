import type { TsApiRegisterOptions } from '../types';
import type { Range } from 'vscode-languageserver/node';
import type { CodeActionContext } from 'vscode-languageserver/node';
import type { CodeAction } from 'vscode-languageserver/node';
import { CodeActionKind } from 'vscode-languageserver/node';
import { tsEditToVueEdit } from './rename';
import * as dedupe from '../utils/dedupe';

export function register({ mapper }: TsApiRegisterOptions) {

	return (uri: string, range: Range, context: CodeActionContext) => {

		const tsResult = onTs(uri, range, context);

		return dedupe.withCodeAction(tsResult);
	}

	function onTs(uri: string, range: Range, context: CodeActionContext) {

		let result: CodeAction[] = [];

		for (const tsRange of mapper.ts.to(uri, range.start, range.end)) {

			if (!tsRange.sourceMap?.capabilities.codeActions)
				continue;

			let tsCodeActions = tsRange.languageService.getCodeActions(tsRange.textDocument.uri, tsRange, context);
			if (!tsCodeActions)
				continue;

			if (tsRange.sourceMap && !tsRange.sourceMap.capabilities.organizeImports) {
				tsCodeActions = tsCodeActions.filter(codeAction =>
					codeAction.kind !== CodeActionKind.SourceOrganizeImports
					&& codeAction.kind !== CodeActionKind.SourceFixAll
				);
			}

			for (const tsCodeAction of tsCodeActions) {
				if (tsCodeAction.title.indexOf('__VLS_') >= 0) continue

				const edit = tsCodeAction.edit ? tsEditToVueEdit(tsCodeAction.edit, mapper, () => true) : undefined;
				if (tsCodeAction.edit && !edit) continue;

				result.push({
					...tsCodeAction,
					edit,
				});
			}
		}

		return result;
	}
}
