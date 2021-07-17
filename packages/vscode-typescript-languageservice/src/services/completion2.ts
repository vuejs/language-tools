import type * as ts from 'typescript';
import type { Position } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceHost } from '..';
import * as completion from './completion';

export function register(
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	host: LanguageServiceHost
) {
	const worker = completion.register(languageService, getTextDocument, host);
	return async (uri: string, position: Position, options?: ts.GetCompletionsAtPositionOptions) => {

		const document = getTextDocument(uri);
		if (!document) return [];

		const preferences = await host.getPreferences?.(document) ?? {};

		return worker(uri, position, {
			...preferences,
			...options,
		});
	}
}
