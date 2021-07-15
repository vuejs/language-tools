import type * as ts from 'typescript';
import {
	DocumentHighlight,
	DocumentHighlightKind,
	Position,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript/lib/tsserverlibrary')) {
	return (uri: string, position: Position): DocumentHighlight[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const highlights = languageService.getDocumentHighlights(fileName, offset, [fileName]);
		if (!highlights) return [];

		const results: DocumentHighlight[] = [];

		for (const highlight of highlights) {
			for (const span of highlight.highlightSpans) {
				results.push({
					kind: span.kind === ts.HighlightSpanKind.writtenReference ? DocumentHighlightKind.Write : DocumentHighlightKind.Read,
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
