import { Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-html-languageservice';
import * as globalServices from '../globalServices';
import { isInsideRange } from '@volar/shared';
import type { HTMLDocument } from 'vscode-html-languageservice';

export function register() {

	const cache = new Map<string, [number, HTMLDocument]>();

	return (document: TextDocument, range: Range): Range | undefined => {

		const vueHtmlDoc = getHtmlDocument(document);
		const ranges = globalServices.html.findLinkedEditingRanges(document, range.start, vueHtmlDoc);
		if (ranges?.length !== 2) {
			return;
		}

		const { select, other } = getSelectAndOther(ranges[0], ranges[1], range);
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

	function getHtmlDocument(doc: TextDocument) {
		const cacheData = cache.get(doc.uri);
		if (!cacheData || cacheData[0] !== doc.version) {
			const newHtmlDoc = globalServices.html.parseHTMLDocument(doc);
			cache.set(doc.uri, [doc.version, newHtmlDoc]);
			return newHtmlDoc;
		}
		return cacheData[1];
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
