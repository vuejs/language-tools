import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Settings } from '..';
import * as completion from './completion';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	settings: Settings,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	const worker = completion.register(languageService, getTextDocument, ts);
	return async (uri: string, position: vscode.Position, options?: ts.GetCompletionsAtPositionOptions): Promise<vscode.CompletionList | undefined> => {

		const document = getTextDocument(uri);
		if (!document) return;

		const preferences = await settings.getPreferences?.(document) ?? {};

		return worker(uri, position, {
			...preferences,
			...options,
		});
	}
}
