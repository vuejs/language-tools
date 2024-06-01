import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { collectVars, createTsAst, endOfLine, newLine } from '../common';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateTemplateChild } from './templateChild';

export function* generateVFor(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ForNode,
	currentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string | undefined
): Generator<Code> {
	const { source } = node.parseResult;
	const { leftExpressionRange, leftExpressionText } = parseVForNode(node);
	const forBlockVars: string[] = [];

	yield `for (const [`;
	if (leftExpressionRange && leftExpressionText) {
		const collectAst = createTsAst(options.ts, node.parseResult, `const [${leftExpressionText}]`);
		collectVars(options.ts, collectAst, collectAst, forBlockVars);
		yield [
			leftExpressionText,
			'template',
			leftExpressionRange.start,
			ctx.codeFeatures.all,
		];
	}
	yield `] of `;
	if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		yield `__VLS_getVForSourceType(`;
		yield* generateInterpolation(
			options,
			ctx,
			source.content,
			source.loc,
			source.loc.start.offset,
			ctx.codeFeatures.all,
			'(',
			')'
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
						prop.value.content,
						prop.value.loc,
						prop.value.loc.start.offset,
						ctx.codeFeatures.all,
						'(',
						')'
					);
					yield endOfLine;
				}
			}
		}
	}
	if (isFragment) {
		yield* ctx.resetDirectiveComments('end of v-for start');
	}
	let prev: CompilerDOM.TemplateChildNode | undefined;
	for (const childNode of node.children) {
		yield* generateTemplateChild(options, ctx, childNode, currentComponent, prev, componentCtxVar);
		prev = childNode;
	}
	for (const varName of forBlockVars) {
		ctx.removeLocalVariable(varName);
	}
	yield* ctx.generateAutoImportCompletion();
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
		? node.loc.source.substring(
			leftExpressionRange.start - node.loc.start.offset,
			leftExpressionRange.end - node.loc.start.offset
		)
		: undefined;
	return {
		leftExpressionRange,
		leftExpressionText,
	};
}
