import type * as ts from 'typescript';
import type { WorkspaceEdit } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath } from '@volar/shared';
import { fileTextChangesToWorkspaceEdit } from './rename';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (oldUri: string, newUri: string): WorkspaceEdit | undefined => {
		const fileToRename = uriToFsPath(oldUri);
		const newFilePath = uriToFsPath(newUri);
		const response = languageService.getEditsForFileRename(fileToRename, newFilePath, {}, { allowTextChangesInNewFiles: true });
		const edits = fileTextChangesToWorkspaceEdit(response, getTextDocument);
		return edits;
	};
}
