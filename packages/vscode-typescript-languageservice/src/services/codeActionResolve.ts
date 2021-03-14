import type * as ts from 'typescript';
import {
	CodeAction,
} from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { fileTextChangesToWorkspaceEdit } from './rename';
import { Data } from './codeActions';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (codeAction: CodeAction) => {

		const data = codeAction.data as Data;

		if (data?.type === 'fixAll') {
			const fixs = data.fixIds.map(fixId => {
				try {
					return languageService.getCombinedCodeFix({ type: 'file', fileName: data.fileName }, fixId, {} /* TODO */, {} /* TODO */)
				} catch { }
			});
			const changes = fixs.map(fix => fix?.changes ?? []).flat();
			codeAction.edit = fileTextChangesToWorkspaceEdit(changes, getTextDocument);
		}
		else if (data?.type === 'refactor') {
			const editInfo = languageService.getEditsForRefactor(data.fileName, {} /* TODO */, data.range, data.refactorName, data.actionName, {} /* TODO */);
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
