import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { fileTextChangesToWorkspaceEdit } from './rename';
import type { GetConfiguration } from '../createLanguageService';
import { URI } from 'vscode-uri';
import { getFormatCodeSettings } from '../configs/getFormatCodeSettings';
import { getUserPreferences } from '../configs/getUserPreferences';

export function register(
	rootUri: URI,
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	getConfiguration: GetConfiguration,
) {
	return async (oldUri: string, newUri: string): Promise<vscode.WorkspaceEdit | undefined> => {

		const document = getTextDocument(oldUri);
		const [formatOptions, preferences] = document ? await Promise.all([
			getFormatCodeSettings(getConfiguration, document.uri),
			getUserPreferences(getConfiguration, document.uri, rootUri),
		]) : [{}, {}];

		const fileToRename = shared.uriToFileName(oldUri);
		const newFilePath = shared.uriToFileName(newUri);

		let response: ReturnType<typeof languageService.getEditsForFileRename> | undefined;
		try { response = languageService.getEditsForFileRename(fileToRename, newFilePath, formatOptions, preferences); } catch { }
		if (!response?.length) return;

		const edits = fileTextChangesToWorkspaceEdit(response, getTextDocument);
		return edits;
	};
}
