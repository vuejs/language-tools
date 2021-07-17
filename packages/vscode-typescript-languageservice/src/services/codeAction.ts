import type * as ts from 'typescript';
import {
	Range,
	CodeActionContext,
	CodeAction,
	CodeActionKind,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { fileTextChangesToWorkspaceEdit } from './rename';
import * as fixNames from '../utils/fixNames';
import type { LanguageServiceHost } from '../';

export interface FixAllData {
	type: 'fixAll',
	uri: string,
	fileName: string,
	fixIds: {}[],
}
export interface RefactorData {
	type: 'refactor',
	uri: string,
	fileName: string,
	refactorName: string,
	actionName: string,
	range: { pos: number, end: number },
}

export type Data = FixAllData | RefactorData;

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost
) {
	return async (uri: string, range: Range, context: CodeActionContext) => {

		const document = getTextDocument(uri);
		if (!document) return;

		const [formatOptions, preferences] = await Promise.all([
			host.getFormatOptions?.(document) ?? {},
			host.getPreferences?.(document) ?? {},
		]);

		const fileName = uriToFsPath(document.uri);
		const start = document.offsetAt(range.start);
		const end = document.offsetAt(range.start);
		const errorCodes = context.diagnostics.map(error => error.code) as number[];
		let result: CodeAction[] = [];

		if (
			!context.only
			|| context.only.includes(CodeActionKind.QuickFix)
		) {
			try {
				const codeFixes = languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences);
				for (const codeFix of codeFixes) {
					result = result.concat(transformCodeFix(codeFix));
				}
			} catch { }
		}

		if (
			context.only?.includes(CodeActionKind.Refactor)
			|| context.only?.includes(CodeActionKind.RefactorExtract)
			|| context.only?.includes(CodeActionKind.RefactorInline)
			|| context.only?.includes(CodeActionKind.RefactorRewrite)
		) {
			try {
				const refactors = languageService.getApplicableRefactors(fileName, { pos: start, end: end }, preferences, undefined /* TODO */, undefined /* TODO */);
				for (const refactor of refactors) {
					result = result.concat(transformRefactor(refactor));
				}
			} catch { }
		}

		if (
			context.only?.includes(CodeActionKind.Source)
			|| context.only?.includes(CodeActionKind.SourceOrganizeImports)
		) {
			try {
				const changes = languageService.organizeImports({ type: 'file', fileName: fileName }, formatOptions, preferences);
				const edit = fileTextChangesToWorkspaceEdit(changes, getTextDocument);
				result.push(CodeAction.create(
					'Organize Imports',
					edit,
					CodeActionKind.SourceOrganizeImports,
				));
			} catch { }
		}

		if (
			context.only?.includes(CodeActionKind.Source)
			|| context.only?.includes(CodeActionKind.SourceFixAll)
		) {
			const action = CodeAction.create('Fix All', CodeActionKind.SourceFixAll);
			const data: FixAllData = {
				uri,
				type: 'fixAll',
				fileName,
				fixIds: [
					fixNames.classIncorrectlyImplementsInterface,
					fixNames.awaitInSyncFunction,
					fixNames.unreachableCode,
				],
			};
			action.data = data;
			result.push(action);
		}

		if (context.only?.includes(CodeActionKind.Source)) {
			{
				const action = CodeAction.create('Remove all unused code', CodeActionKind.SourceFixAll);
				const data: FixAllData = {
					uri,
					type: 'fixAll',
					fileName,
					fixIds: [
						// not working and throw
						fixNames.unusedIdentifier,
						// TODO: remove patching
						'unusedIdentifier_prefix',
						'unusedIdentifier_deleteImports',
						'unusedIdentifier_delete',
						'unusedIdentifier_infer',
					],
				};
				action.data = data;
				result.push(action);
			}
			{
				const action = CodeAction.create('Add all missing imports', CodeActionKind.SourceFixAll);
				const data: FixAllData = {
					uri,
					type: 'fixAll',
					fileName,
					fixIds: [
						// not working and throw
						fixNames.fixImport,
						// TODO: remove patching
						'fixMissingImport',
					],
				};
				action.data = data;
				result.push(action);
			}
		}

		for (const codeAction of result) {
			codeAction.diagnostics = context.diagnostics;
		}

		return result;

		function transformCodeFix(codeFix: ts.CodeFixAction) {
			const edit = fileTextChangesToWorkspaceEdit(codeFix.changes, getTextDocument);
			const codeActions: CodeAction[] = [];
			const fix = CodeAction.create(
				codeFix.description,
				edit,
				CodeActionKind.QuickFix,
			);
			codeActions.push(fix);
			if (codeFix.fixAllDescription && codeFix.fixId) {
				const fixAll = CodeAction.create(
					codeFix.fixAllDescription,
					CodeActionKind.QuickFix,
				);
				const data: FixAllData = {
					uri,
					type: 'fixAll',
					fileName,
					fixIds: [codeFix.fixId],
				};
				fixAll.data = data;
				codeActions.push(fixAll);
			}
			return codeActions;
		}
		function transformRefactor(refactor: ts.ApplicableRefactorInfo) {
			const codeActions: CodeAction[] = [];
			for (const action of refactor.actions) {
				const codeAction = CodeAction.create(
					action.name,
					CodeActionKind.Refactor,
				);
				const data: RefactorData = {
					uri,
					type: 'refactor',
					fileName,
					range: { pos: start, end: end },
					refactorName: refactor.name,
					actionName: action.name,
				};
				codeAction.data = data;
				if (action.notApplicableReason) {
					codeAction.disabled = { reason: action.notApplicableReason };
				}
				if (refactor.inlineable) {
					codeAction.isPreferred = true;
				}
				codeActions.push(codeAction);
			}
			return codeActions
		}
	};
}
