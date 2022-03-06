import { transformLocations } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { tsEditToVueEdit } from './rename';
import * as shared from '@volar/shared';

export  interface Data {
	lsType: 'script' | 'template'
	tsData: any
}

export function register(context: LanguageServiceRuntimeContext) {

	return async (uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) => {

		const sourceFile = context.sourceFiles.get(uri);
		if (sourceFile) {

			const descriptor = sourceFile.getDescriptor();
			const document = sourceFile.getTextDocument();

			const scripts = [descriptor.script, descriptor.scriptSetup].filter(shared.notEmpty);
			const styles = descriptor.styles;

			const scriptRanges = scripts
				.map(script => ({
					start: document.positionAt(script.startTagEnd),
					end: document.positionAt(script.startTagEnd + script.content.length),
				}))
				.map(scriptRange => shared.getOverlapRange(scriptRange, range))
				.filter(shared.notEmpty);
			const styleRanges = styles
				.map(script => ({
					start: document.positionAt(script.startTagEnd),
					end: document.positionAt(script.startTagEnd + script.content.length),
				}))
				.map(scriptRange => shared.getOverlapRange(scriptRange, range))
				.filter(shared.notEmpty);

			const tsResult = (await Promise.all(scriptRanges.map(scriptRange => onTs(uri, scriptRange, codeActionContext)))).flat();
			const cssResult = (await Promise.all(styleRanges.map(styleRange => onCss(uri, styleRange, codeActionContext)))).flat();

			return dedupe.withCodeAction([
				...tsResult,
				...cssResult,
			]);
		}

		const tsResult = await onTs(uri, range, codeActionContext);
		const cssResult = onCss(uri, range, codeActionContext);

		return dedupe.withCodeAction([
			...tsResult,
			...cssResult,
		]);
	}

	async function onTs(uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) {

		let result: vscode.CodeAction[] = [];

		for (const tsLoc of context.sourceFiles.toEmbeddedLocation(
			uri,
			range.start,
			range.end,
			undefined,
			sourceMap => !!sourceMap.capabilities.codeActions,
		)) {

			if (tsLoc.lsType === undefined)
				continue;

			const tsLs = context.getTsLs(tsLoc.lsType);
			const tsContext: vscode.CodeActionContext = {
				diagnostics: transformLocations(
					codeActionContext.diagnostics,
					vueRange => tsLoc.type === 'embedded-ts' ? tsLoc.sourceMap.getMappedRange(vueRange.start, vueRange.end)?.[0] : vueRange,
				),
				only: codeActionContext.only,
			};

			if (tsLoc.type === 'source-ts' && tsLoc.lsType !== 'script')
				continue;

			let tsCodeActions = await tsLs.getCodeActions(tsLoc.uri, tsLoc.range, tsContext);
			if (!tsCodeActions)
				continue;

			for (const tsCodeAction of tsCodeActions) {
				if (tsCodeAction.title.indexOf('__VLS_') >= 0) continue

				const vueEdit = tsCodeAction.edit ? tsEditToVueEdit(tsLoc.lsType, false, tsCodeAction.edit, context.sourceFiles, () => true) : undefined;
				if (tsCodeAction.edit && !vueEdit) continue;

				const data: Data = {
					lsType: tsLoc.lsType,
					tsData: tsCodeAction.data,
				};

				result.push({
					...tsCodeAction,
					// @ts-expect-error
					data,
					edit: vueEdit,
				});
			}
		}

		return result;
	}
	function onCss(uri: string, range: vscode.Range, codeActionContext: vscode.CodeActionContext) {

		let result: vscode.CodeAction[] = [];

		const sourceFile = context.sourceFiles.get(uri);
		if (!sourceFile)
			return result;

		for (const sourceMap of sourceFile.getCssSourceMaps()) {

			const stylesheet = context.getStylesheet(sourceMap.mappedDocument);
			const cssLs = context.getCssLs(sourceMap.mappedDocument.languageId);

			if (!cssLs || !stylesheet)
				continue;

			for (const [cssRange] of sourceMap.getMappedRanges(range.start, range.end)) {
				const cssContext: vscode.CodeActionContext = {
					diagnostics: transformLocations(
						codeActionContext.diagnostics,
						vueRange => sourceMap.getMappedRange(vueRange.start, vueRange.end)?.[0],
					),
					only: codeActionContext.only,
				};
				const cssCodeActions = cssLs.doCodeActions2(sourceMap.mappedDocument, cssRange, cssContext, stylesheet) as vscode.CodeAction[];
				for (const codeAction of cssCodeActions) {

					// TODO
					// cssCodeAction.edit?.changeAnnotations
					// cssCodeAction.edit?.documentChanges...

					if (codeAction.edit) {
						const vueEdit: vscode.WorkspaceEdit = {};
						for (const cssUri in codeAction.edit.changes) {
							if (cssUri === sourceMap.mappedDocument.uri) {
								if (!vueEdit.changes) {
									vueEdit.changes = {};
								}
								vueEdit.changes[uri] = transformLocations(
									vueEdit.changes[cssUri],
									cssRange_2 => sourceMap.getSourceRange(cssRange_2.start, cssRange_2.end)?.[0],
								);
							}
						}
						if (codeAction.edit.documentChanges) {
							for (const cssDocChange of codeAction.edit.documentChanges) {
								if (!vueEdit.documentChanges) {
									vueEdit.documentChanges = [];
								}
								if (vscode.TextDocumentEdit.is(cssDocChange)) {
									cssDocChange.textDocument = {
										uri: uri,
										version: sourceMap.sourceDocument.version,
									};
									cssDocChange.edits = transformLocations(
										cssDocChange.edits,
										cssRange_2 => sourceMap.getSourceRange(cssRange_2.start, cssRange_2.end)?.[0],
									);
									vueEdit.documentChanges.push(cssDocChange);
								}
							}
						}
						codeAction.edit = vueEdit;
					}
					if (codeAction.diagnostics) {
						codeAction.diagnostics = transformLocations(
							codeAction.diagnostics,
							cssRange_2 => sourceMap.getSourceRange(cssRange_2.start, cssRange_2.end)?.[0],
						);
					}

					result.push(codeAction);
				}
			}
		}

		return result;
	}
}
