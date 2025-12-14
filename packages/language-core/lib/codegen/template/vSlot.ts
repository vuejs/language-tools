import * as CompilerDOM from '@vue/compiler-dom';
import { replaceSourceRange } from 'muggle-string';
import type * as ts from 'typescript';
import type { Code } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { codeFeatures } from '../codeFeatures';
import { endOfLine, getTypeScriptAST, newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';
import { generateTemplateChild } from './templateChild';

export function* generateVSlot(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	slotDir: CompilerDOM.DirectiveNode | undefined,
	ctxVar: string,
): Generator<Code> {
	const slotVar = ctx.getInternalVariable();
	if (slotDir) {
		yield `{${newLine}`;
		yield `const { `;
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
			const token = yield* startBoundary(
				'template',
				slotDir.loc.start.offset,
				codeFeatures.withoutHighlightAndCompletion,
			);
			yield `default`;
			yield endBoundary(token, slotDir.loc.start.offset + (slotDir.rawName?.length ?? 0));
		}
	}
	else {
		yield `const { `;
		// #932: reference for implicit default slot
		const token = yield* startBoundary('template', node.loc.start.offset, codeFeatures.navigation);
		yield `default`;
		yield endBoundary(token, node.loc.end.offset);
	}
	yield `: ${slotVar} } = ${ctxVar}.slots!${endOfLine}`;

	const endScope = ctx.startScope();
	if (slotDir?.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const slotAst = getTypeScriptAST(options.typescript, options.template, `(${slotDir.exp.content}) => {}`);
		yield* generateSlotParameters(options, ctx, slotAst, slotDir.exp, slotVar);
		ctx.declare(...collectBindingNames(options.typescript, slotAst, slotAst));
	}
	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child);
	}
	yield* endScope();

	if (slotDir) {
		let isStatic = true;
		if (slotDir.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			isStatic = slotDir.arg.isStatic;
		}
		if (isStatic && !slotDir.arg) {
			yield `${ctxVar}.slots!['`;
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
	const { typescript: ts } = options;
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
		options.template,
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
	yield `] = __VLS_vSlot(${slotVar}!`;

	if (types.some(t => t)) {
		yield `, `;
		const token = yield* startBoundary('template', exp.loc.start.offset, codeFeatures.verification);
		yield `(`;
		yield* types.flatMap(type => type ? [`_`, type, `, `] : `_, `);
		yield `) => [] as any`;
		yield endBoundary(token, exp.loc.end.offset);
	}
	yield `)${endOfLine}`;
}
