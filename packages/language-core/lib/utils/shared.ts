import { hyphenate } from '@vue/shared';
import type * as ts from 'typescript';
import type { TextRange } from '../types';

export { hyphenate as hyphenateTag } from '@vue/shared';

export function hyphenateAttr(str: string) {
	let hyphencase = hyphenate(str);
	// fix https://github.com/vuejs/core/issues/8811
	if (str.length && str[0] !== str[0].toLowerCase()) {
		hyphencase = '-' + hyphencase;
	}
	return hyphencase;
}

export function getSlotsPropertyName(vueVersion: number) {
	return vueVersion < 3 ? '$scopedSlots' : '$slots';
}

export function getStartEnd(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
): TextRange {
	return {
		start: (ts as any).getTokenPosOfNode(node, ast) as number,
		end: node.end,
	};
}

export function getNodeText(
	ts: typeof import('typescript'),
	node: ts.Node,
	ast: ts.SourceFile,
) {
	const { start, end } = getStartEnd(ts, node, ast);
	return ast.text.slice(start, end);
}
