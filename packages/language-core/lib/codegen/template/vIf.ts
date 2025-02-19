import * as CompilerDOM from '@vue/compiler-dom';
import { toString } from 'muggle-string';
import type { Code } from '../../types';
import { newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateTemplateChild } from './templateChild';

export function* generateVIf(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.IfNode
): Generator<Code> {

	let originalBlockConditionsLength = ctx.blockConditions.length;

	for (let i = 0; i < node.branches.length; i++) {

		const branch = node.branches[i];

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
			const codes = [
				...generateInterpolation(
					options,
					ctx,
					'template',
					ctx.codeFeatures.all,
					branch.condition.content,
					branch.condition.loc.start.offset,
					branch.condition.loc,
					'(',
					')'
				),
			];
			for (const code of codes) {
				yield code;
			}
			ctx.blockConditions.push(toString(codes));
			addedBlockCondition = true;
			yield ` `;
		}

		yield `{${newLine}`;
		if (isFragment(node)) {
			yield* ctx.resetDirectiveComments('end of v-if start');
		}
		let prev: CompilerDOM.TemplateChildNode | undefined;
		for (const childNode of branch.children) {
			yield* generateTemplateChild(options, ctx, childNode, prev);
			prev = childNode;
		}
		yield* ctx.generateAutoImportCompletion();
		yield `}${newLine}`;

		if (addedBlockCondition) {
			ctx.blockConditions[ctx.blockConditions.length - 1] = `!(${ctx.blockConditions[ctx.blockConditions.length - 1]})`;
		}
	}

	ctx.blockConditions.length = originalBlockConditionsLength;
}

function isFragment(node: CompilerDOM.IfNode) {
	return node.codegenNode
		&& 'consequent' in node.codegenNode
		&& 'tag' in node.codegenNode.consequent
		&& node.codegenNode.consequent.tag === CompilerDOM.FRAGMENT;
}
