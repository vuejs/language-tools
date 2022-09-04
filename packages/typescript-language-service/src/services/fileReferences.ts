import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import { entriesToLocations } from '../utils/transforms';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

export function register(
	rootUri: URI,
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	getTextDocument2: (uri: string) => TextDocument | undefined,
) {
	return (uri: string): vscode.Location[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.getPathOfUri(document.uri);

		let entries: ReturnType<typeof languageService.getFileReferences> | undefined;
		try { entries = languageService.getFileReferences(fileName); } catch { }
		if (!entries) return [];

		return entriesToLocations(rootUri, [...entries], getTextDocument2);
	};
}
