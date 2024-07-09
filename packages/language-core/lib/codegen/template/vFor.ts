import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { collectVars, createTsAst, newLine } from '../common';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateTemplateChild } from './templateChild';
import { generateElement } from './element';

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
	if (node.codegenNode) {
		for (const argument of node.codegenNode.children.arguments) {
			if (
				argument.type === CompilerDOM.NodeTypes.JS_FUNCTION_EXPRESSION
				&& argument.returns?.type === CompilerDOM.NodeTypes.VNODE_CALL
				&& argument.returns?.props?.type === CompilerDOM.NodeTypes.JS_OBJECT_EXPRESSION
			) {
				if (argument.returns.tag !== CompilerDOM.FRAGMENT) {
					isFragment = false;
					continue;
				}
				// #4539, #329
				for (const prop of argument.returns.props.properties) {
					if (
						prop.key.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
						&& prop.value.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					) {
						const codeBeforeKeyOffset = prop.value.loc.start.offset - node.codegenNode.loc.start.offset;
						const codeBeforeKey = node.codegenNode.loc.source.slice(0, codeBeforeKeyOffset);
						const isShorthand = codeBeforeKey[codeBeforeKey.length - 1] === ':';
						const lastKeyStartOffset = isShorthand ? codeBeforeKeyOffset : codeBeforeKey.lastIndexOf('key');
						let fakeProp: CompilerDOM.AttributeNode | CompilerDOM.DirectiveNode;
						if (prop.value.isStatic) {
							fakeProp = {
								type: CompilerDOM.NodeTypes.ATTRIBUTE,
								name: prop.key.content,
								nameLoc: {} as any,
								value: {
									type: CompilerDOM.NodeTypes.TEXT,
									content: prop.value.content,
									loc: prop.value.loc,
								},
								loc: {
									...prop.loc,
									start: {
										...prop.loc.start,
										offset: node.codegenNode.loc.start.offset + lastKeyStartOffset,
									},
									end: {
										...prop.loc.end,
										offset: node.codegenNode.loc.start.offset + lastKeyStartOffset + 3,
									}
								},
							};
						}
						else {
							fakeProp = {
								type: CompilerDOM.NodeTypes.DIRECTIVE,
								name: 'bind',
								rawName: '',
								arg: {
									...prop.key,
									loc: {
										...prop.key.loc,
										start: {
											...prop.key.loc.start,
											offset: node.codegenNode.loc.start.offset + lastKeyStartOffset,
										},
										end: {
											...prop.key.loc.end,
											offset: node.codegenNode.loc.start.offset + lastKeyStartOffset + 3,
										}
									}
								},
								exp: prop.value,
								loc: {
									...prop.key.loc,
									start: {
										...prop.key.loc.start,
										offset: node.codegenNode.loc.start.offset + lastKeyStartOffset,
									},
									end: {
										...prop.key.loc.end,
										offset: node.codegenNode.loc.start.offset + lastKeyStartOffset + 3,
									}
								},
								modifiers: [],
							};
						}
						yield* generateElement(options, ctx, {
							type: CompilerDOM.NodeTypes.ELEMENT,
							tag: 'template',
							tagType: CompilerDOM.ElementTypes.TEMPLATE,
							ns: 0,
							children: node.children,
							loc: node.codegenNode.loc,
							props: [fakeProp],
							codegenNode: undefined,
						}, currentComponent, componentCtxVar);
						yield JSON.stringify({
							prop, codegenNode: node.codegenNode
						}, null, 2);
					}
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
