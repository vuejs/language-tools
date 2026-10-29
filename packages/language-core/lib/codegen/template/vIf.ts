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
			const accessMark = ctx.accessLog.length;
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
			)];
			yield* codes;
			ctx.conditions.push({ text: toString(codes), accesses: ctx.accessLog.slice(accessMark) });
			addedBlockCondition = true;
			yield ` `;
		}

		yield `{${newLine}`;
		for (const child of branch.children) {
			yield* generateTemplateChild(options, ctx, child, i !== 0, true);
		}
		yield `}${newLine}`;

		if (addedBlockCondition) {
			const condition = ctx.conditions[ctx.conditions.length - 1]!;
			condition.text = `!${condition.text}`;
		}
	}

	ctx.conditions.length = originalBlockConditionsLength;
}
