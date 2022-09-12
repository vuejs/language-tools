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
	return (uri: string, position: vscode.Position): vscode.Location[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.getPathOfUri(document.uri);
		const offset = document.offsetAt(position);

		let entries: ReturnType<typeof languageService.getReferencesAtPosition>;
		try { entries = languageService.getReferencesAtPosition(fileName, offset); } catch { }
		if (!entries) return [];

		return entriesToLocations(rootUri, [...entries], getTextDocument2);
	};
}
