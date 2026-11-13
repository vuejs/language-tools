import * as CompilerDOM from '@vue/compiler-dom';
import { codeToString, scriptFeatures } from '@vue/language-core';
import type { TsCode, TsPiece } from '../tsCode';
import { newLine } from '../writers';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateTemplateChild } from './templateChild';

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
			const accessMark = ctx.accessLog.length;
			const codes = [...generateInterpolation(
				options,
				ctx,
				options.template,
				{ features: scriptFeatures },
				branch.condition.content,
				branch.condition.loc.start.offset,
				`(`,
				`)`,
			)];
			yield* codes;
			// Locals (`v-for` / `v-slot` variables) are `const`, so their narrowing already
			// reaches handler closures; list them too, or a condition that reads only locals
			// is replayed against the narrowed type (TS2367 in a `v-else` handler).
			const locals = ctx.getExpression(options.template, branch.condition.loc.start.offset, branch.condition.content)
				.references
				.filter(reference => reference.local)
				.map(reference => reference.name);
			ctx.conditions.push({
				text: codeToString(codes as TsPiece[]),
				accesses: [...ctx.accessLog.slice(accessMark), ...locals],
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
