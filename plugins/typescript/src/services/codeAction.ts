import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { fileTextChangesToWorkspaceEdit } from './rename';
import * as fixNames from '../utils/fixNames';
import type { GetConfiguration } from '../createLanguageService';
import { URI } from 'vscode-uri';
import { getFormatCodeSettings } from '../configs/getFormatCodeSettings';
import { getUserPreferences } from '../configs/getUserPreferences';

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
	range: { pos: number, end: number; },
}

export interface OrganizeImportsData {
	type: 'organizeImports',
	uri: string,
	fileName: string,
}

export type Data = FixAllData | RefactorData | OrganizeImportsData;

export function register(
	rootUri: URI,
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	getConfiguration: GetConfiguration,
) {
	return async (uri: string, range: vscode.Range, context: vscode.CodeActionContext) => {

		const document = getTextDocument(uri);
		if (!document) return;

		const [formatOptions, preferences] = await Promise.all([
			getFormatCodeSettings(getConfiguration, document.uri),
			getUserPreferences(getConfiguration, document.uri, rootUri),
		]);

		const fileName = shared.getPathOfUri(document.uri);
		const start = document.offsetAt(range.start);
		const end = document.offsetAt(range.end);
		let result: vscode.CodeAction[] = [];

		const onlyQuickFix = matchOnlyKind(`${vscode.CodeActionKind.QuickFix}.ts`);
		if (!context.only || onlyQuickFix) {
			for (const error of context.diagnostics) {
				try {
					const codeFixes = languageService.getCodeFixesAtPosition(
						fileName,
						document.offsetAt(error.range.start),
						document.offsetAt(error.range.end),
						[Number(error.code)],
						formatOptions,
						preferences,
					);
					for (const codeFix of codeFixes) {
						result = result.concat(transformCodeFix(codeFix, [error], onlyQuickFix ?? vscode.CodeActionKind.Empty));
					}
				} catch { }
			}
		}

		if (context.only) {
			for (const only of context.only) {
				if (only.split('.')[0] === vscode.CodeActionKind.Refactor) {
					try {
						const refactors = languageService.getApplicableRefactors(fileName, { pos: start, end: end }, preferences, undefined, only);
						for (const refactor of refactors) {
							result = result.concat(transformRefactor(refactor));
						}
					} catch { }
				}
			}
		}
		else {
			try {
				const refactors = languageService.getApplicableRefactors(fileName, { pos: start, end: end }, preferences, undefined, undefined);
				for (const refactor of refactors) {
					result = result.concat(transformRefactor(refactor));
				}
			} catch { }
		}

		const onlySourceOrganizeImports = matchOnlyKind(`${vscode.CodeActionKind.SourceOrganizeImports}.ts`);
		if (onlySourceOrganizeImports) {
			const action = vscode.CodeAction.create('Organize Imports', onlySourceOrganizeImports);
			action.data = {
				type: 'organizeImports',
				uri,
				fileName,
			} satisfies OrganizeImportsData;
			result.push(action);
		}

		const onlySourceFixAll = matchOnlyKind(`${vscode.CodeActionKind.SourceFixAll}.ts`);
		if (onlySourceFixAll) {
			const action = vscode.CodeAction.create('Fix All', onlySourceFixAll);
			action.data = {
				uri,
				type: 'fixAll',
				fileName,
				fixIds: [
					fixNames.classIncorrectlyImplementsInterface,
					fixNames.awaitInSyncFunction,
					fixNames.unreachableCode,
				],
			} satisfies FixAllData;
			result.push(action);
		}

		const onlyRemoveUnused = matchOnlyKind(`${vscode.CodeActionKind.Source}.removeUnused.ts`);
		if (onlyRemoveUnused) {
			const action = vscode.CodeAction.create('Remove all unused code', onlyRemoveUnused);
			action.data = {
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
			} satisfies FixAllData;
			result.push(action);
		}

		const onlyAddMissingImports = matchOnlyKind(`${vscode.CodeActionKind.Source}.addMissingImports.ts`);
		if (onlyAddMissingImports) {
			const action = vscode.CodeAction.create('Add all missing imports', onlyAddMissingImports);
			action.data = {
				uri,
				type: 'fixAll',
				fileName,
				fixIds: [
					// not working and throw
					fixNames.fixImport,
					// TODO: remove patching
					'fixMissingImport',
				],
			} satisfies FixAllData;
			result.push(action);
		}

		for (const codeAction of result) {
			if (codeAction.diagnostics === undefined) {
				codeAction.diagnostics = context.diagnostics;
			}
		}

		return result;

		function matchOnlyKind(kind: string) {
			if (context.only) {
				for (const only of context.only) {

					const a = only.split('.');
					const b = kind.split('.');

					if (a.length <= b.length) {

						let matchNums = 0;

						for (let i = 0; i < a.length; i++) {
							if (a[i] == b[i]) {
								matchNums++;
							}
						}

						if (matchNums === a.length)
							return only;
					}
				}
			}
		}
		function transformCodeFix(codeFix: ts.CodeFixAction, diagnostics: vscode.Diagnostic[], kind: vscode.CodeActionKind) {
			const edit = fileTextChangesToWorkspaceEdit(codeFix.changes, getTextDocument);
			const codeActions: vscode.CodeAction[] = [];
			const fix = vscode.CodeAction.create(
				codeFix.description,
				edit,
				kind,
			);
			fix.diagnostics = diagnostics;
			codeActions.push(fix);
			if (codeFix.fixAllDescription && codeFix.fixId) {
				const fixAll = vscode.CodeAction.create(
					codeFix.fixAllDescription,
					kind,
				);
				fixAll.data = {
					uri,
					type: 'fixAll',
					fileName,
					fixIds: [codeFix.fixId],
				} satisfies FixAllData;
				fixAll.diagnostics = diagnostics;
				codeActions.push(fixAll);
			}
			return codeActions;
		}
		function transformRefactor(refactor: ts.ApplicableRefactorInfo) {
			const codeActions: vscode.CodeAction[] = [];
			for (const action of refactor.actions) {
				const codeAction = vscode.CodeAction.create(
					action.description,
					action.kind,
				);
				codeAction.data = {
					uri,
					type: 'refactor',
					fileName,
					range: { pos: start, end: end },
					refactorName: refactor.name,
					actionName: action.name,
				} satisfies RefactorData;
				if (action.notApplicableReason) {
					codeAction.disabled = { reason: action.notApplicableReason };
				}
				if (refactor.inlineable) {
					codeAction.isPreferred = true;
				}
				codeActions.push(codeAction);
			}
			return codeActions;
		}
	};
}
