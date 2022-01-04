import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript/lib/tsserverlibrary')) {
	return (uri: string, position: vscode.Position): vscode.DocumentHighlight[] => {

		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(document.uri);
		const offset = document.offsetAt(position);

		let highlights: ReturnType<typeof languageService.getDocumentHighlights> | undefined;
		try { highlights = languageService.getDocumentHighlights(fileName, offset, [fileName]); } catch { }
		if (!highlights) return [];

		const results: vscode.DocumentHighlight[] = [];

		for (const highlight of highlights) {
			for (const span of highlight.highlightSpans) {
				results.push({
					kind: span.kind === ts.HighlightSpanKind.writtenReference ? vscode.DocumentHighlightKind.Write : vscode.DocumentHighlightKind.Read,
					range: {
						start: document.positionAt(span.textSpan.start),
						end: document.positionAt(span.textSpan.start + span.textSpan.length),
					},
				});
			}
		}

		return results;
	};
}
