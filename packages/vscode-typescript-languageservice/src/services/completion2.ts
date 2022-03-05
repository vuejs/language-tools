import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceHost } from '..';
import * as completion from './completion';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	const worker = completion.register(languageService, getTextDocument, ts);
	return async (uri: string, position: vscode.Position, options?: ts.GetCompletionsAtPositionOptions): Promise<vscode.CompletionList | undefined> => {

		const document = getTextDocument(uri);
		if (!document) return;

		const preferences = await host.getPreferences?.(document) ?? {};

		return worker(uri, position, {
			...preferences,
			...options,
		});
	}
}
