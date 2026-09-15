import * as CompilerDOM from '@vue/compiler-dom';
import { toString } from 'muggle-string';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateSlotChildrenVar } from './slotChildren';
import { generateTemplateChild } from './templateChild';

export function* generateVIf(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.IfNode,
): Generator<Code> {
	const parentChildren = ctx.slotChildren;
	const parentProviders = ctx.slotProviders;
	const providerBranches: string[] = [];
	const branches: string[] = [];
	const originalBlockConditionsLength = ctx.blockConditions.length;

	for (let i = 0; i < node.branches.length; i++) {
		const branch = node.branches[i]!;

		if (i === 0) {
			yield `if `;
		}
		else if (branch.condition) {
			yield `else if `;
		}
		else {
			yield `else `;
		}

		let addedBlockCondition = false;

		if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			const codes = [...generateInterpolation(
				options,
				ctx,
				options.template,
				codeFeatures.all,
				branch.condition.content,
				branch.condition.loc.start.offset,
				`(`,
				`)`,
			)];
			yield* codes;
			ctx.blockConditions.push(toString(codes));
			addedBlockCondition = true;
			yield ` `;
		}

		yield `{${newLine}`;
		ctx.slotChildren = parentChildren ? [] : undefined;
		ctx.slotProviders = parentProviders ? [] : undefined;
		for (const child of branch.children) {
			yield* generateTemplateChild(options, ctx, child, i !== 0, true);
		}
		if (ctx.slotChildren) {
			branches.push(yield* generateSlotChildrenVar(ctx));
		}
		if (ctx.slotProviders) {
			providerBranches.push(`(${ctx.slotProviders.join(' & ') || '{}'})`);
		}
		yield `}${newLine}`;

		if (addedBlockCondition) {
			ctx.blockConditions[ctx.blockConditions.length - 1] = `!${ctx.blockConditions[ctx.blockConditions.length - 1]}`;
		}
	}

	ctx.slotChildren = parentChildren;
	ctx.slotProviders = parentProviders;
	if (parentProviders) {
		if (node.branches.at(-1)?.condition) {
			providerBranches.push('{}');
		}
		parentProviders.push(`(${providerBranches.join(' | ')})`);
	}
	if (parentChildren) {
		if (node.branches.at(-1)?.condition) {
			branches.push('[]');
		}
		parentChildren.push(`...(${branches.join(' | ')})`);
	}
	ctx.blockConditions.length = originalBlockConditionsLength;
}
