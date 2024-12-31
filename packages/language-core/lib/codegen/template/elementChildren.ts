import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { endOfLine, wrapWith } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateTemplateChild } from './templateChild';

export function* generateElementChildren(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	isDefaultSlot: boolean = false
): Generator<Code> {
	yield* ctx.resetDirectiveComments('end of element children start');
	let prev: CompilerDOM.TemplateChildNode | undefined;
	for (const childNode of node.children) {
		yield* generateTemplateChild(options, ctx, childNode, prev);
		prev = childNode;
	}
	yield* ctx.generateAutoImportCompletion();

	// fix https://github.com/vuejs/language-tools/issues/932
	if (
		ctx.currentComponent
		&& isDefaultSlot
		&& node.children.length
		&& node.tagType === CompilerDOM.ElementTypes.COMPONENT
	) {
		ctx.currentComponent.used = true;
		yield `${ctx.currentComponent.ctxVar}.slots!.`;
		yield* wrapWith(
			node.children[0].loc.start.offset,
			node.children[node.children.length - 1].loc.end.offset,
			ctx.codeFeatures.navigation,
			`default`
		);
		yield endOfLine;
	}
}
