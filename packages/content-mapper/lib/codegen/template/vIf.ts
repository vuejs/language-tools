import * as CompilerDOM from '@vue/compiler-dom';
import { codeToString, scriptFeatures } from '@vue/language-core';
import type { TsCode } from '../tsCode';
import { newLine } from '../writers';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateTemplateChild } from './templateChild';

// The start of a property read of the preceding identifier: `.`, `?.`, `[` or `!.`.
const propertyAccessRE = /^\s*(?:!\s*)*(?:\??\.|\[)/;

export function* generateVIf(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.IfNode,
): Generator<TsCode> {
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
			const { content, loc } = branch.condition;
			const accessMark = ctx.accessLog.length;
			const codes = [...generateInterpolation(
				options,
				ctx,
				options.template,
				{ features: scriptFeatures },
				content,
				loc.start.offset,
				`(`,
				`)`,
			)];
			yield* codes;
			const { references } = ctx.getExpression(options.template, loc.start.offset, content);
			ctx.conditions.push({
				text: codeToString(codes),
				accesses: ctx.accessLog.slice(accessMark),
				readsLocalProperty: references.some(({ name, offset, local, member }) =>
					local && member && propertyAccessRE.test(content.slice(offset + name.length))
				),
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
			const condition = ctx.conditions[ctx.conditions.length - 1]!;
			condition.text = `!${condition.text}`;
		}
	}

	ctx.conditions.length = originalBlockConditionsLength;
}
