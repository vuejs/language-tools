import * as CompilerDOM from '@vue/compiler-dom';
import { codeToString, scriptFeatures, type TemplateReference } from '@vue/language-core';
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
			const { references } = ctx.getExpression(options.template, loc.start.offset, content);
			ctx.addCondition(
				codeToString(codes as TsPiece[]),
				narrowsPropertyAccess(options, content, references),
				references.filter(reference => readsByName(options, reference)).map(({ name }) => name),
			);
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
	code: string,
	references: readonly TemplateReference[],
) {
	if (references.some(({ name, local }) => !local && !options.setupConsts.has(name))) {
		return true;
	}
	const visit = (node: ts.Node): boolean =>
		options.typescript.isPropertyAccessExpression(node)
		|| options.typescript.isElementAccessExpression(node)
		|| !!node.forEachChild(visit);
	return !!getTypeScriptAST(options.typescript, options.template, `(${code})`).forEachChild(visit);
}

/** Whether the generated code reads the reference by its name, which a block scope within may declare again. */
function readsByName(options: TemplateCodegenOptions, { name, local }: TemplateReference) {
	return local
		|| options.setupConsts.has(name)
		|| options.setupRefs.has(name)
		|| options.setupBindings.has(name);
}
