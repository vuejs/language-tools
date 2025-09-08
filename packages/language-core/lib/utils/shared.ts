import type * as CompilerDOM from '@vue/compiler-dom';
import { hyphenate } from '@vue/shared';
import type * as ts from 'typescript';
import type { Sfc, TextRange } from '../types';

export { hyphenate as hyphenateTag } from '@vue/shared';

export function hyphenateAttr(str: string) {
	let hyphencase = hyphenate(str);
	// fix https://github.com/vuejs/core/issues/8811
	if (str.length && str[0] !== str[0]!.toLowerCase()) {
		hyphencase = '-' + hyphencase;
	}
	return hyphencase;
}

export function getSlotsPropertyName(vueVersion: number) {
	return vueVersion < 3 ? '$scopedSlots' : '$slots';
}

export function getElementTagOffsets(
	node: CompilerDOM.ElementNode,
	template: NonNullable<Sfc['template']>,
) {
	const tagOffsets = [
		template.content.indexOf(node.tag, node.loc.start.offset),
	];
	if (!node.isSelfClosing && template.lang === 'html') {
		const endTagOffset = node.loc.start.offset + node.loc.source.lastIndexOf(node.tag);
		if (endTagOffset > tagOffsets[0]!) {
			tagOffsets.push(endTagOffset);
		}
	}
	return tagOffsets as [number] | [number, number];
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
