import * as ts from 'typescript';
import {
	TextDocument,
	DocumentHighlight,
	DocumentHighlightKind,
	Position,
} from 'vscode-languageserver';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService) {
	return (document: TextDocument, position: Position): DocumentHighlight[] => {
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
