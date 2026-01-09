import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { codeFeatures } from '../codeFeatures';
import { getTypeScriptAST, newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateTemplateChild } from './templateChild';

export function* generateVFor(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ForNode,
): Generator<Code> {
	const { source } = node.parseResult;
	const { leftExpressionRange, leftExpressionText } = parseVForNode(node);
	const endScope = ctx.startScope();

	yield `for (const [`;
	if (leftExpressionRange && leftExpressionText) {
		const collectAst = getTypeScriptAST(options.typescript, options.template, `const [${leftExpressionText}]`);
		ctx.declare(...collectBindingNames(options.typescript, collectAst, collectAst));
		yield [
			leftExpressionText,
			'template',
			leftExpressionRange.start,
			codeFeatures.all,
		];
	}
	yield `] of `;
	if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		yield `__VLS_vFor(`;
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			codeFeatures.all,
			source.content,
			source.loc.start.offset,
			`(`,
			`)`,
		);
		yield `!)`; // #3102
	}
	else {
		yield `{} as any`;
	}
	yield `) {${newLine}`;

	const { inVFor } = ctx;
	ctx.inVFor = true;
	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child, false, true);
	}
	ctx.inVFor = inVFor;

	yield* endScope();
	yield `}${newLine}`;
}

export function parseVForNode(node: CompilerDOM.ForNode) {
	const { value, key, index } = node.parseResult;
	const leftExpressionRange = (value || key || index)
		? {
			start: (value ?? key ?? index)!.loc.start.offset,
			end: (index ?? key ?? value)!.loc.end.offset,
		}
		: undefined;
	const leftExpressionText = leftExpressionRange
		? node.loc.source.slice(
			leftExpressionRange.start - node.loc.start.offset,
			leftExpressionRange.end - node.loc.start.offset,
		)
		: undefined;
	return {
		leftExpressionRange,
		leftExpressionText,
	};
}
