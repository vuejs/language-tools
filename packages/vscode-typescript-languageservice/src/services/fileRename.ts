import type * as ts from 'typescript';
import type * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { fileTextChangesToWorkspaceEdit } from './rename';
import type { LanguageServiceHost } from '../';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost
) {
	return async (oldUri: string, newUri: string): Promise<vscode.WorkspaceEdit | undefined> => {

		const document = getTextDocument(oldUri);
		const [formatOptions, preferences] = document ? await Promise.all([
			host.getFormatOptions?.(document) ?? {},
			host.getPreferences?.(document) ?? {},
		]) : [{}, {}];

		const fileToRename = shared.uriToFsPath(oldUri);
		const newFilePath = shared.uriToFsPath(newUri);
		const response = languageService.getEditsForFileRename(fileToRename, newFilePath, formatOptions, preferences);
		if (!response.length) return;
		const edits = fileTextChangesToWorkspaceEdit(response, getTextDocument);
		return edits;
	};
}
