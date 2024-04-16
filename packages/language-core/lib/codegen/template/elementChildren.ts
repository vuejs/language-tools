import type * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { endOfLine, wrapWith } from '../common';
import type { TemplateCodegenContext, TemplateCodegenOptions } from './index';
import { generateTemplateNode } from './templateNode';

export function* generateElementChildren(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	parentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string | undefined,
): Generator<Code> {
	yield* ctx.resetDirectiveComments('end of element children start');
	let prev: CompilerDOM.TemplateChildNode | undefined;
	for (const childNode of node.children) {
		yield* generateTemplateNode(options, ctx, childNode, parentComponent, prev, componentCtxVar);
		prev = childNode;
	}

	// fix https://github.com/vuejs/language-tools/issues/932
	if (!ctx.hasSlotElements.has(node) && node.children.length) {
		yield `(${componentCtxVar}.slots!).`;
		yield* wrapWith(
			node.children[0].loc.start.offset,
			node.children[node.children.length - 1].loc.end.offset,
			ctx.codeFeatures.navigation,
			`default`,
		);
		yield endOfLine;
	}
}
