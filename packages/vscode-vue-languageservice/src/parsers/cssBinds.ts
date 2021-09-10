import type * as css from 'vscode-css-languageservice';
import type { TextRange } from './types';

type StylesheetNode = {
	children: StylesheetNode[] | undefined,
	end: number,
	length: number,
	offset: number,
	parent: Node | null,
	type: number,
};

export function parse(docText: string, ss: css.Stylesheet) {
	const result: TextRange[] = [];
	visChild(ss as StylesheetNode);
	function visChild(node: StylesheetNode) {
		if (node.type === 22) {
			const nodeText = docText.substring(node.offset, node.end);
			const reg = /\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([^'"][^)]*))\s*\)/g;
			const matchs = nodeText.matchAll(reg);
			for (const match of matchs) {
				if (match.index !== undefined) {
					const matchText = match[1] ?? match[2] ?? match[3];
					const offset = node.offset + match.index + nodeText.substr(match.index).indexOf(matchText);
					result.push({ start: offset, end: offset + matchText.length });
				}
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
