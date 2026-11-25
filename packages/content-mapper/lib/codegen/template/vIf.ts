import * as CompilerDOM from '@vue/compiler-dom';
import { codeToString, scriptFeatures } from '@vue/language-core';
import { getTypeScriptAST } from '@vue/language-core/lib/typescript/typescriptAST';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
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
			const { content, loc } = branch.condition;
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
			ctx.conditions.push({
				text: codeToString(codes as TsPiece[]),
				replayed: narrowsPropertyAccess(options, ctx, content, loc.start.offset),
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

/**
 * Whether the condition narrows a property access, which closures do not keep, unlike the narrowing of `const`
 * identifiers: the locals of the template and the setup consts. The other setup bindings and the context are read
 * through property accesses too, like `x.value` and `__VLS_ctx.x`.
 */
function narrowsPropertyAccess(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	code: string,
	start: number,
) {
	const { references } = ctx.getExpression(options.template, start, code);
	if (references.some(({ name, local }) => !local && !options.setupConsts.has(name))) {
		return true;
	}
	const visit = (node: ts.Node): boolean =>
		options.typescript.isPropertyAccessExpression(node)
		|| options.typescript.isElementAccessExpression(node)
		|| !!node.forEachChild(visit);
	return !!getTypeScriptAST(options.typescript, options.template, `(${code})`).forEachChild(visit);
}
