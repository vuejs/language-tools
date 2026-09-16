import * as CompilerDOM from '@vue/compiler-dom';
import { toString } from 'muggle-string';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation, getConditionBindings } from './interpolation';
import { generateTemplateChild } from './templateChild';

export function* generateVIf(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.IfNode,
): Generator<Code> {
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
			ctx.blockConditions.push({
				code: toString(codes),
				bindings: getConditionBindings(options.typescript, ctx, options.template, toString(codes)),
			});
			addedBlockCondition = true;
			yield ` `;
		}

		yield `{${newLine}`;
		for (const child of branch.children) {
			yield* generateTemplateChild(options, ctx, child, i !== 0, true);
		}
		yield `}${newLine}`;

		if (addedBlockCondition) {
			const condition = ctx.blockConditions[ctx.blockConditions.length - 1]!;
			condition.code = `!${condition.code}`;
		}
	}

	ctx.blockConditions.length = originalBlockConditionsLength;
}
