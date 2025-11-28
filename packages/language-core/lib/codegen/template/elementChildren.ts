import type * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateTemplateChild } from './templateChild';

export function* generateElementChildren(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	children: CompilerDOM.TemplateChildNode[],
	enterNode = true,
): Generator<Code> {
	const endScope = ctx.startScope();
	for (const child of children) {
		yield* generateTemplateChild(options, ctx, child, enterNode);
	}
	yield* endScope();
}
