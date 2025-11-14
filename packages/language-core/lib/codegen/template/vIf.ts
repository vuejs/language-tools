import * as CompilerDOM from '@vue/compiler-dom';
import { toString } from 'muggle-string';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import { generateElementChildren } from './elementChildren';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

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
				'template',
				codeFeatures.all,
				branch.condition.content,
				branch.condition.loc.start.offset,
				`(`,
				`)`,
			)];
			yield* codes;
			ctx.blockConditions.push(toString(codes));
			addedBlockCondition = true;
			yield ` `;
		}

		const shouldEnter = isFragment(node)
			|| branch.isTemplateIf
			|| branch.children.some(child => child.type === CompilerDOM.NodeTypes.COMMENT);

		yield `{${newLine}`;
		yield* generateElementChildren(options, ctx, branch.children, shouldEnter);
		yield `}${newLine}`;

		if (addedBlockCondition) {
			ctx.blockConditions[ctx.blockConditions.length - 1] = `!${ctx.blockConditions[ctx.blockConditions.length - 1]}`;
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
