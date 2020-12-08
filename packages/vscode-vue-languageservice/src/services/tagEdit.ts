import {
	TextDocument,
	Range,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import * as globalServices from '../globalServices';
import { isInsideRange } from '@volar/shared';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, range: Range): Range | undefined => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult) return htmlResult;

		function getHtmlResult(sourceFile: SourceFile) {
			const vueHtmlDoc = sourceFile.getVueHtmlDocument();

			const highlights = globalServices.html.findDocumentHighlights(document, range.start, vueHtmlDoc);
			if (highlights.length !== 2) {
				return;
			}

			const { select, other } = getSelectAndOther(highlights[0].range, highlights[1].range, range);
			if (!select || !other) {
				return;
			}

			const result: Range = {
				start: {
					line: other.start.line + range.start.line - select.start.line,
					character: other.start.character + range.start.character - select.start.character,
				},
				end: {
					line: other.end.line + range.end.line - select.end.line,
					character: other.end.character + range.end.character - select.end.character,
				},
			};
			return result;
		}
	}
}

function getSelectAndOther(a: Range, b: Range, range: Range) {
	if (isInsideRange(a, range)) {
		return {
			select: a,
			other: b,
		}
	}
	if (isInsideRange(b, range)) {
		return {
			select: b,
			other: a,
		}
	}
	return {
		select: undefined,
		other: undefined,
	}
}
