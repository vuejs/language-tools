import type * as css from 'vscode-css-languageservice';
import type { TextRange } from '../types';

type StylesheetNode = {
	children: StylesheetNode[] | undefined,
	end: number,
	length: number,
	offset: number,
	parent: Node | null,
	type: number,
};

export function parseCssBindRanges(docText: string, ss: css.Stylesheet) {
	const result: TextRange[] = [];
	visChild(ss as StylesheetNode);
	function visChild(node: StylesheetNode) {
		if (node.type === 22) {
			const nodeText = docText.substring(node.offset, node.end);
			for (const textRange of getMatchBindTexts(nodeText)) {
				result.push({
					start: textRange.start + node.offset,
					end: textRange.end + node.offset,
				});
			}
		}
		else if (node.children) {
			for (let i = 0; i < node.children.length; i++) {
				visChild(node.children[i]);
			}
		}
	}
	return result;
}

export function* getMatchBindTexts(nodeText: string) {
	const reg = /\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([^'"][^)]*))\s*\)/g;
	const matchs = nodeText.matchAll(reg);
	for (const match of matchs) {
		if (match.index !== undefined) {
			const matchText = match[1] ?? match[2] ?? match[3];
			if (matchText !== undefined) {
				const offset = match.index + nodeText.substr(match.index).indexOf(matchText);
				yield { start: offset, end: offset + matchText.length };
			}
		}
	}
}
