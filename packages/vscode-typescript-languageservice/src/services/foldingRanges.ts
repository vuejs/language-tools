import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as ts from 'typescript';
import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService) {
	return (document: TextDocument) => {
		const fileName = uriToFsPath(document.uri);
		const outliningSpans = languageService.getOutliningSpans(fileName);
		const foldingRanges: FoldingRange[] = [];

		for (const outliningSpan of outliningSpans) {
			outliningSpan.kind
			const start = document.positionAt(outliningSpan.textSpan.start);
			const end = document.positionAt(outliningSpan.textSpan.start + outliningSpan.textSpan.length);
			const foldingRange = FoldingRange.create(
				start.line,
				end.line,
				start.character,
				end.character,
				transformFoldingRangeKind(outliningSpan.kind),
			);
			foldingRanges.push(foldingRange);
		}

		return foldingRanges;
	};
}

function transformFoldingRangeKind(tsKind: ts.OutliningSpanKind) {
	switch (tsKind) {
		case ts.OutliningSpanKind.Comment: return FoldingRangeKind.Comment;
		case ts.OutliningSpanKind.Imports: return FoldingRangeKind.Imports;
		case ts.OutliningSpanKind.Region: return FoldingRangeKind.Region;
	}
}
