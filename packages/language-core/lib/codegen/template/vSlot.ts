import * as CompilerDOM from '@vue/compiler-dom';
import { replaceSourceRange } from 'muggle-string';
import type * as ts from 'typescript';
import type { Code } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { codeFeatures } from '../codeFeatures';
import { createTsAst, endOfLine, newLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';
import type { TemplateCodegenContext } from './context';
import { generateElementChildren } from './elementChildren';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';

export function* generateVSlot(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	slotDir: CompilerDOM.DirectiveNode | undefined,
): Generator<Code> {
	if (!ctx.currentComponent) {
		return;
	}
	const slotBlockVars: string[] = [];
	const slotVar = ctx.getInternalVariable();

	if (slotDir) {
		yield `{${newLine}`;
	}

	if (slotDir || node.children.length) {
		ctx.currentComponent.used = true;

		yield `const { `;
		if (slotDir) {
			if (slotDir.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && slotDir.arg.content) {
				yield* generateObjectProperty(
					options,
					ctx,
					slotDir.arg.loc.source,
					slotDir.arg.loc.start.offset,
					slotDir.arg.isStatic ? codeFeatures.withoutHighlight : codeFeatures.all,
					false,
					true,
				);
			}
			else {
				yield* wrapWith(
					slotDir.loc.start.offset,
					slotDir.loc.start.offset + (slotDir.rawName?.length ?? 0),
					codeFeatures.withoutHighlightAndCompletion,
					`default`,
				);
			}
		}
		else {
			// #932: reference for implicit default slot
			yield* wrapWith(
				node.loc.start.offset,
				node.loc.end.offset,
				codeFeatures.navigation,
				`default`,
			);
		}
		yield `: ${slotVar} } = ${ctx.currentComponent.ctxVar}.slots!${endOfLine}`;
	}

	if (slotDir?.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const slotAst = createTsAst(options.ts, ctx.inlineTsAsts, `(${slotDir.exp.content}) => {}`);
		slotBlockVars.push(...collectBindingNames(options.ts, slotAst, slotAst));
		yield* generateSlotParameters(options, ctx, slotAst, slotDir.exp, slotVar);
	}

	for (const varName of slotBlockVars) {
		ctx.addLocalVariable(varName);
	}

	yield* generateElementChildren(options, ctx, node.children);

	for (const varName of slotBlockVars) {
		ctx.removeLocalVariable(varName);
	}

	if (slotDir) {
		let isStatic = true;
		if (slotDir.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			isStatic = slotDir.arg.isStatic;
		}
		if (isStatic && !slotDir.arg) {
			yield `${ctx.currentComponent.ctxVar}.slots!['`;
			yield [
				'',
				'template',
				slotDir.loc.start.offset + (
					slotDir.loc.source.startsWith('#')
						? '#'.length
						: slotDir.loc.source.startsWith('v-slot:')
						? 'v-slot:'.length
						: 0
				),
				codeFeatures.completion,
			];
			yield `'/* empty slot name completion */]${endOfLine}`;
		}
		yield `}${newLine}`;
	}
}

function* generateSlotParameters(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	ast: ts.SourceFile,
	exp: CompilerDOM.SimpleExpressionNode,
	slotVar: string,
): Generator<Code> {
	const { ts } = options;
	const statement = ast.statements[0];

	if (!statement || !ts.isExpressionStatement(statement) || !ts.isArrowFunction(statement.expression)) {
		return;
	}

	const { expression } = statement;
	const startOffset = exp.loc.start.offset - 1;
	const types: (Code | null)[] = [];

	const interpolation = [...generateInterpolation(
		options,
		ctx,
		'template',
		codeFeatures.all,
		ast.text,
		startOffset,
	)];

	replaceSourceRange(interpolation, 'template', startOffset, startOffset + `(`.length);
	replaceSourceRange(
		interpolation,
		'template',
		startOffset + ast.text.length - `) => {}`.length,
		startOffset + ast.text.length,
	);

	for (const { name, type } of expression.parameters) {
		if (type) {
			types.push([
				ast.text.slice(name.end, type.end),
				'template',
				startOffset + name.end,
				codeFeatures.all,
			]);
			replaceSourceRange(interpolation, 'template', startOffset + name.end, startOffset + type.end);
		}
		else {
			types.push(null);
		}
	}

	yield `const [`;
	yield* interpolation;
	yield `] = __VLS_getSlotParameters(${slotVar}!`;

	if (types.some(t => t)) {
		yield `, `;
		yield* wrapWith(
			exp.loc.start.offset,
			exp.loc.end.offset,
			codeFeatures.verification,
			`(`,
			...types.flatMap(type => type ? [`_`, type, `, `] : `_, `),
			`) => [] as any`,
		);
	}
	yield `)${endOfLine}`;
}
