import * as CompilerDOM from '@vue/compiler-dom';
import { toString } from 'muggle-string';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateTemplateChild } from './templateChild';

export function* generateVIf(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.IfNode,
): Generator<Code> {
	const originalBlockConditionsLength = ctx.conditions.length;
	const negated = new Set<string>();

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
		let conditionNames = new Set<string>();

		ctx.enterNarrowedScope();

		for (const name of negated) {
			ctx.addNarrowedBinding(name);
		}

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
				true,
				conditionNames,
			)];
			for (const name of conditionNames) {
				ctx.addNarrowedBinding(name);
			}
			yield* codes;
			ctx.conditions.push(toString(codes));
			addedBlockCondition = true;
			yield ` `;
		}

		yield `{${newLine}`;
		for (const child of branch.children) {
			yield* generateTemplateChild(options, ctx, child, i !== 0, true);
		}
		yield `}${newLine}`;

		ctx.exitNarrowedScope();

		for (const name of conditionNames) {
			negated.add(name);
		}

		if (addedBlockCondition) {
			ctx.conditions[ctx.conditions.length - 1] = `!${ctx.conditions[ctx.conditions.length - 1]}`;
		}
	}

	ctx.conditions.length = originalBlockConditionsLength;
}
