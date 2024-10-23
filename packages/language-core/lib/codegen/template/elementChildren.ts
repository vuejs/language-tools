import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { endOfLine, wrapWith } from '../common';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateTemplateChild } from './templateChild';

export function* generateElementChildren(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	currentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string | undefined
): Generator<Code> {
	yield* ctx.resetDirectiveComments('end of element children start');
	let prev: CompilerDOM.TemplateChildNode | undefined;
	for (const childNode of node.children) {
		yield* generateTemplateChild(options, ctx, childNode, currentComponent, prev, componentCtxVar);
		prev = childNode;
	}
	yield* ctx.generateAutoImportCompletion();

	// fix https://github.com/vuejs/language-tools/issues/932
	if (
		componentCtxVar
		&& !ctx.hasSlotElements.has(node)
		&& node.children.length
		&& node.tagType !== CompilerDOM.ElementTypes.ELEMENT
		&& node.tagType !== CompilerDOM.ElementTypes.TEMPLATE
	) {
		ctx.usedComponentCtxVars.add(componentCtxVar);
		yield `__VLS_nonNullable(${componentCtxVar}.slots).`;
		yield* wrapWith(
			node.children[0].loc.start.offset,
			node.children[node.children.length - 1].loc.end.offset,
			ctx.codeFeatures.navigation,
			`default`
		);
		yield endOfLine;
	}
}
