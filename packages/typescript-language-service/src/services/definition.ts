import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import { boundSpanToLocationLinks } from '../utils/transforms';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

export function register(
	rootUri: URI,
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	getTextDocument2: (uri: string) => TextDocument | undefined,
) {
	return (uri: string, position: vscode.Position) => {

		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.getPathOfUri(document.uri);
		const offset = document.offsetAt(position);

		let info: ReturnType<typeof languageService.getDefinitionAndBoundSpan> | undefined;
		try { info = languageService.getDefinitionAndBoundSpan(fileName, offset); } catch { }
		if (!info) return [];

		return boundSpanToLocationLinks(rootUri, info, document, getTextDocument2);
	};
}
