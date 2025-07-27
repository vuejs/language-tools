import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { codeFeatures } from '../codeFeatures';
import { createTsAst, endOfLine, newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import { generateElementChildren } from './elementChildren';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generateVFor(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ForNode,
): Generator<Code> {
	const { source } = node.parseResult;
	const { leftExpressionRange, leftExpressionText } = parseVForNode(node);
	const forBlockVars: string[] = [];

	yield `for (const [`;
	if (leftExpressionRange && leftExpressionText) {
		const collectAst = createTsAst(options.ts, ctx.inlineTsAsts, `const [${leftExpressionText}]`);
		forBlockVars.push(...collectBindingNames(options.ts, collectAst, collectAst));
		yield [
			leftExpressionText,
			'template',
			leftExpressionRange.start,
			codeFeatures.all,
		];
	}
	yield `] of `;
	if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		yield `__VLS_getVForSourceType(`;
		yield* generateInterpolation(
			options,
			ctx,
			'template',
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

	for (const varName of forBlockVars) {
		ctx.addLocalVariable(varName);
	}

	let isFragment = true;
	for (const argument of node.codegenNode?.children.arguments ?? []) {
		if (
			argument.type === CompilerDOM.NodeTypes.JS_FUNCTION_EXPRESSION
			&& argument.returns?.type === CompilerDOM.NodeTypes.VNODE_CALL
			&& argument.returns?.props?.type === CompilerDOM.NodeTypes.JS_OBJECT_EXPRESSION
		) {
			if (argument.returns.tag !== CompilerDOM.FRAGMENT) {
				isFragment = false;
				continue;
			}
			for (const prop of argument.returns.props.properties) {
				if (
					prop.value.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& !prop.value.isStatic
				) {
					yield* generateInterpolation(
						options,
						ctx,
						'template',
						codeFeatures.all,
						prop.value.content,
						prop.value.loc.start.offset,
						`(`,
						`)`,
					);
					yield endOfLine;
				}
			}
		}
	}

	const { inVFor } = ctx;
	ctx.inVFor = true;
	yield* generateElementChildren(options, ctx, node.children, isFragment);
	ctx.inVFor = inVFor;

	for (const varName of forBlockVars) {
		ctx.removeLocalVariable(varName);
	}
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
