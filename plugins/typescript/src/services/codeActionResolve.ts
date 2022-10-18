import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { fileTextChangesToWorkspaceEdit } from './rename';
import { Data } from './codeAction';
import type { GetConfiguration } from '../createLangaugeService';
import { URI } from 'vscode-uri';
import { getFormatCodeSettings } from '../configs/getFormatCodeSettings';
import { getUserPreferences } from '../configs/getUserPreferences';

export function register(
	rootUri: URI,
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	getConfiguration: GetConfiguration,
) {
	return async (codeAction: vscode.CodeAction) => {

		const data: Data = codeAction.data;
		const document = getTextDocument(data.uri);
		const [formatOptions, preferences] = document ? await Promise.all([
			getFormatCodeSettings(getConfiguration, document.uri),
			getUserPreferences(getConfiguration, document.uri, rootUri),
		]) : [{}, {}];

		if (data?.type === 'fixAll') {
			const fixs = data.fixIds.map(fixId => {
				try {
					return languageService.getCombinedCodeFix({ type: 'file', fileName: data.fileName }, fixId, formatOptions, preferences);
				} catch { }
			});
			const changes = fixs.map(fix => fix?.changes ?? []).flat();
			codeAction.edit = fileTextChangesToWorkspaceEdit(rootUri, changes, getTextDocument);
		}
		else if (data?.type === 'refactor') {
			const editInfo = languageService.getEditsForRefactor(data.fileName, formatOptions, data.range, data.refactorName, data.actionName, preferences);
			if (editInfo) {
				const edit = fileTextChangesToWorkspaceEdit(rootUri, editInfo.edits, getTextDocument);
				codeAction.edit = edit;
			}
		}
		else if (data?.type === 'organizeImports') {
			const changes = languageService.organizeImports({ type: 'file', fileName: data.fileName }, formatOptions, preferences);
			const edit = fileTextChangesToWorkspaceEdit(rootUri, changes, getTextDocument);
			codeAction.edit = edit;
		}

		return codeAction;
	};
}
