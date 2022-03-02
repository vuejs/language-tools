import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as css from 'vscode-css-languageservice';
import { LanguageServiceContext } from '../types';

export function parse(
	css: typeof import('vscode-css-languageservice'),
	styleDocuments: {
		textDocument: TextDocument;
		stylesheet: css.Stylesheet | undefined;
	}[],
	context: LanguageServiceContext,
) {
	const result = new Map<string, Map<string, Set<[number, number]>>>();
	for (const sourceMap of styleDocuments) {
		if (!sourceMap.stylesheet) continue;
		for (const [className, offsets] of findClassNames(css, sourceMap.textDocument, sourceMap.stylesheet, context)) {
			for (const offset of offsets) {
				addClassName(sourceMap.textDocument.uri, className, offset);
			}
		}
	}
	return result;
	function addClassName(uri: string, className: string, range: [number, number]) {
		if (!result.has(uri))
			result.set(uri, new Map());
		if (!result.get(uri)!.has(className))
			result.get(uri)!.set(className, new Set());
		result.get(uri)!.get(className)?.add(range);
	}
}

function findClassNames(
	css: typeof import('vscode-css-languageservice'),
	doc: TextDocument,
	ss: css.Stylesheet,
	context: LanguageServiceContext,
) {
	const result = new Map<string, Set<[number, number]>>();
	const cssLs = context.getCssLs(doc.languageId);
	if (!cssLs) return result;
	const symbols = cssLs.findDocumentSymbols(doc, ss);
	const usedNodes = new Set<number>();
	for (const s of symbols) {
		if (s.kind === css.SymbolKind.Class) {
			const nodeText = doc.getText(s.location.range);
			// https://stackoverflow.com/questions/448981/which-characters-are-valid-in-css-class-names-selectors
			const classNames_1 = s.name.matchAll(/(?<=\.)-?[_a-zA-Z]+[_a-zA-Z0-9-]*/g);
			const classNames_2 = nodeText.matchAll(/(?<=\.)-?[_a-zA-Z]+[_a-zA-Z0-9-]*/g);

			for (const _className_1 of classNames_1) {
				if (_className_1.index === undefined) continue;
				const className_1 = _className_1.toString();
				for (const _className_2 of classNames_2) {
					if (_className_2.index === undefined) continue;
					const className_2 = _className_2.toString();
					if (className_1 === className_2) {
						if (!result.has(className_1)) {
							result.set(className_1, new Set());
						}
						const startIndex = doc.offsetAt(s.location.range.start) + _className_2.index - 1;
						if (usedNodes.has(startIndex)) continue;
						usedNodes.add(startIndex);
						result.get(className_1)!.add([startIndex, startIndex + className_1.length + 1]);
						break;
					}
				}
			}
		}
	}
	return result;
}
