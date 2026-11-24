import * as CompilerDOM from '@vue/compiler-dom';
import { codeToString, scriptFeatures, type TemplateReference, type TypeScript } from '@vue/language-core';
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
			const accessMark = ctx.accessLog.length;
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
			ctx.conditions.push({
				text: codeToString(codes as TsPiece[]),
				accesses: ctx.accessLog.slice(accessMark),
				readsLocalProperty: readsLocalProperty(options.typescript, options, content, references),
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
 * Whether the condition `code` reads a property of a block-scope local, like `row.meta`, `(row).meta` or
 * `row!['meta']`: closures keep the narrowing of the local, which is `const`, but not of its properties.
 */
function readsLocalProperty(
	ts: TypeScript,
	options: TemplateCodegenOptions,
	code: string,
	references: readonly TemplateReference[],
) {
	// the code is parsed in parentheses, so its offsets are one char after those of the references
	const localOffsets = new Set(
		references.filter(({ local, member }) => local && member).map(({ offset }) => offset + 1),
	);
	if (!localOffsets.size) {
		return false;
	}
	const ast = getTypeScriptAST(ts, options.template, `(${code})`);
	const visit = (node: ts.Node): boolean => {
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			let object = node.expression;
			while (ts.isParenthesizedExpression(object) || ts.isNonNullExpression(object)) {
				object = object.expression;
			}
			if (ts.isIdentifier(object) && localOffsets.has(object.getStart(ast))) {
				return true;
			}
		}
		return !!node.forEachChild(visit);
	};
	return !!ast.forEachChild(visit);
}
