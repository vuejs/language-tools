import type * as ts from 'typescript';
import * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { fileTextChangesToWorkspaceEdit } from './rename';
import { Data } from './codeAction';
import type { LanguageServiceHost } from '../';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost
) {
	return async (codeAction: vscode.CodeAction) => {

		const data = codeAction.data as Data;

		const document = getTextDocument(data.uri);
		const [formatOptions, preferences] = document ? await Promise.all([
			host.getFormatOptions?.(document) ?? {},
			host.getPreferences?.(document) ?? {},
		]) : [{}, {}];

		if (data?.type === 'fixAll') {
			const fixs = data.fixIds.map(fixId => {
				try {
					return languageService.getCombinedCodeFix({ type: 'file', fileName: data.fileName }, fixId, formatOptions, preferences);
				} catch { }
			});
			const changes = fixs.map(fix => fix?.changes ?? []).flat();
			codeAction.edit = fileTextChangesToWorkspaceEdit(changes, getTextDocument);
		}
		else if (data?.type === 'refactor') {
			const editInfo = languageService.getEditsForRefactor(data.fileName, formatOptions, data.range, data.refactorName, data.actionName, preferences);
			if (editInfo) {
				const edit = fileTextChangesToWorkspaceEdit(editInfo.edits, getTextDocument);
				// TODO: renameFilename
				// TODO: renameLocation
				codeAction.edit = edit;
			}
		}

		return codeAction;
	};
}
