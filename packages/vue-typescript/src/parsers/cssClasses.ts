import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as css from 'vscode-css-languageservice';
import type { TextRange } from '@volar/vue-code-gen';

export function findClassNames(
	css: typeof import('vscode-css-languageservice'),
	doc: TextDocument,
	ss: css.Stylesheet,
	cssLs: css.LanguageService,
) {
	const result: Record<string, TextRange[]> = {};
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
						if (!result[className_1]) {
							result[className_1] = [];
						}
						const startIndex = doc.offsetAt(s.location.range.start) + _className_2.index - 1;
						if (usedNodes.has(startIndex)) continue;
						usedNodes.add(startIndex);
						result[className_1]!.push({
							start: startIndex,
							end: startIndex + className_1.length + 1,
						});
						break;
					}
				}
			}
		}
	}
	return result;
}
