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
			const reg = /^v-bind\s*\(\s*(\S*)\s*\)$/;
			const match = nodeText.match(reg);
			if (match) {
				const matchText = match[1];
				const offset = node.offset + nodeText.lastIndexOf(matchText);
				result.push({ start: offset, end: offset + matchText.length });
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
