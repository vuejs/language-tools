import type * as ts from 'typescript';
import type { WorkspaceEdit } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath } from '@volar/shared';
import { fileTextChangesToWorkspaceEdit } from './rename';
import type { LanguageServiceHost } from '../';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost
) {
	return async (oldUri: string, newUri: string): Promise<WorkspaceEdit | undefined> => {

		const document = getTextDocument(oldUri);
		const [formatOptions, preferences] = document ? await Promise.all([
			host.getFormatOptions?.(document) ?? {},
			host.getPreferences?.(document) ?? {},
		]) : [{}, {}];

		const fileToRename = uriToFsPath(oldUri);
		const newFilePath = uriToFsPath(newUri);
		const response = languageService.getEditsForFileRename(fileToRename, newFilePath, formatOptions, preferences);
		if (!response.length) return;
		const edits = fileTextChangesToWorkspaceEdit(response, getTextDocument);
		return edits;
	};
}
