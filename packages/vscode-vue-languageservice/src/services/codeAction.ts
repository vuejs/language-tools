import { transformLocations } from '@volar/transforms';
import { WorkspaceEdit } from 'vscode-languageserver-types';
import type { CodeAction, CodeActionContext } from 'vscode-languageserver/node';
import { CodeActionKind, Range, TextDocumentEdit } from 'vscode-languageserver/node';
import type { TsApiRegisterOptions } from '../types';
import * as dedupe from '../utils/dedupe';
import { tsEditToVueEdit } from './rename';

export function register({ mapper }: TsApiRegisterOptions) {

	return (uri: string, range: Range, context: CodeActionContext) => {

		const tsResult = onTs(uri, range, context);
		const cssResult = onCss(uri, range, context);

		return dedupe.withCodeAction([
			...tsResult,
			...cssResult,
		]);
	}

	function onTs(uri: string, range: Range, context: CodeActionContext) {

		let result: CodeAction[] = [];

		for (const tsRange of mapper.ts.to(uri, range.start, range.end)) {

			const tsContext: CodeActionContext = {
				diagnostics: transformLocations(
					context.diagnostics,
					vueRange => tsRange.sourceMap ? tsRange.sourceMap.getMappedRange(vueRange.start, vueRange.end) : vueRange,
				),
				only: context.only,
			};

			if (!tsRange.sourceMap?.capabilities.codeActions)
				continue;

			let tsCodeActions = tsRange.languageService.getCodeActions(tsRange.textDocument.uri, tsRange.range, tsContext);
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
	function onCss(uri: string, range: Range, context: CodeActionContext) {

		const result: CodeAction[] = [];

		for (const cssRange of mapper.css.to(uri, range.start, range.end)) {
			const cssContext: CodeActionContext = {
				diagnostics: transformLocations(
					context.diagnostics,
					vueRange => cssRange.sourceMap.getMappedRange(vueRange.start, vueRange.end),
				),
				only: context.only,
			};
			const cssCodeActions = cssRange.languageService.doCodeActions2(cssRange.textDocument, cssRange.range, cssContext, cssRange.stylesheet);
			for (const cssCodeAction of cssCodeActions) {

				// TODO
				// cssCodeAction.edit?.changeAnnotations
				// cssCodeAction.edit?.documentChanges...

				if (cssCodeAction.edit) {
					const vueEdit: WorkspaceEdit = {};
					for (const cssUri in cssCodeAction.edit.changes) {
						if (cssUri === cssRange.textDocument.uri) {
							if (!vueEdit.changes) {
								vueEdit.changes = {};
							}
							vueEdit.changes[uri] = transformLocations(
								vueEdit.changes[cssUri],
								cssRange_2 => cssRange.sourceMap.getSourceRange(cssRange_2.start, cssRange_2.end),
							);
						}
					}
					if (cssCodeAction.edit.documentChanges) {
						for (const cssDocChange of cssCodeAction.edit.documentChanges) {
							if (!vueEdit.documentChanges) {
								vueEdit.documentChanges = [];
							}
							if (TextDocumentEdit.is(cssDocChange)) {
								cssDocChange.textDocument = {
									uri: uri,
									version: cssRange.sourceMap.sourceDocument.version,
								};
								cssDocChange.edits = transformLocations(
									cssDocChange.edits,
									cssRange_2 => cssRange.sourceMap.getSourceRange(cssRange_2.start, cssRange_2.end),
								);
								vueEdit.documentChanges.push(cssDocChange);
							}
						}
					}
					cssCodeAction.edit = vueEdit;
				}
				if (cssCodeAction.diagnostics) {
					cssCodeAction.diagnostics = transformLocations(
						cssCodeAction.diagnostics,
						cssRange_2 => cssRange.sourceMap.getSourceRange(cssRange_2.start, cssRange_2.end),
					);
				}

				result.push(cssCodeAction);
			}
		}

		return result;
	}
}
