import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript';
import * as vscode from 'vscode-languageserver';
import * as shared from '@volar/shared';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript/lib/tsserverlibrary')) {
	return (uri: string) => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.uriToFsPath(document.uri);
		const outliningSpans = languageService.getOutliningSpans(fileName);
		const foldingRanges: vscode.FoldingRange[] = [];

		for (const outliningSpan of outliningSpans) {
			outliningSpan.kind
			const start = document.positionAt(outliningSpan.textSpan.start);
			const end = document.positionAt(outliningSpan.textSpan.start + outliningSpan.textSpan.length);
			const foldingRange = vscode.FoldingRange.create(
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

	function transformFoldingRangeKind(tsKind: ts.OutliningSpanKind) {
		switch (tsKind) {
			case ts.OutliningSpanKind.Comment: return vscode.FoldingRangeKind.Comment;
			case ts.OutliningSpanKind.Imports: return vscode.FoldingRangeKind.Imports;
			case ts.OutliningSpanKind.Region: return vscode.FoldingRangeKind.Region;
		}
	}
}
