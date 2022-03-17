import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { fileTextChangesToWorkspaceEdit } from './rename';
import type { Settings } from '../';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	settings: Settings,
) {
	return async (oldUri: string, newUri: string): Promise<vscode.WorkspaceEdit | undefined> => {

		const document = getTextDocument(oldUri);
		const [formatOptions, preferences] = document ? await Promise.all([
			settings.getFormatOptions?.(document) ?? {},
			settings.getPreferences?.(document) ?? {},
		]) : [{}, {}];

		const fileToRename = shared.uriToFsPath(oldUri);
		const newFilePath = shared.uriToFsPath(newUri);

		let response: ReturnType<typeof languageService.getEditsForFileRename> | undefined;
		try { response = languageService.getEditsForFileRename(fileToRename, newFilePath, formatOptions, preferences); } catch { }
		if (!response?.length) return;

		const edits = fileTextChangesToWorkspaceEdit(response, getTextDocument);
		return edits;
	};
}
