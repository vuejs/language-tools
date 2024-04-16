import { toString } from "@volar/language-core";
import * as CompilerDOM from '@vue/compiler-dom';
import { isFragment, type TemplateCodegenContext } from ".";
import type { Code } from "../../types";
import { newLine } from "../common";
import type { TemplateCodegenOptions } from "./index";
import { generateInterpolation } from "./interpolation";
import { generateTemplateNode } from "./templateNode";

export function* generateVIf(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.IfNode,
	parentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string | undefined,
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
					branch.condition.content,
					branch.condition.loc,
					branch.condition.loc.start.offset,
					ctx.codeFeatures.all,
					'(',
					')',
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
			yield* generateTemplateNode(options, ctx, childNode, parentComponent, prev, componentCtxVar);
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
