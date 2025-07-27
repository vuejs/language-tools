import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { getStartEnd } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { createTsAst, endOfLine, newLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';
import type { TemplateCodegenContext } from './context';
import { generateElementChildren } from './elementChildren';
import type { TemplateCodegenOptions } from './index';
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
		yield* generateSlotParameters(options, slotAst, slotDir.exp, slotVar);
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
	ast: ts.SourceFile,
	exp: CompilerDOM.SimpleExpressionNode,
	slotVar: string,
): Generator<Code> {
	const { ts } = options;

	const statement = ast.statements[0];
	if (!ts.isExpressionStatement(statement) || !ts.isArrowFunction(statement.expression)) {
		return;
	}

	const { expression } = statement;
	const startOffset = exp.loc.start.offset - 1;
	const modifies: [Code[], number, number][] = [];
	const types: (Code | null)[] = [];

	for (const { name, type } of expression.parameters) {
		if (type) {
			modifies.push([
				[``],
				name.end,
				type.end,
			]);
			types.push(chunk(getStartEnd(ts, type, ast).start, type.end));
		}
		else {
			types.push(null);
		}
	}

	yield `const [`;
	let nextStart = 1;
	for (const [codes, start, end] of modifies) {
		yield chunk(nextStart, start);
		yield* codes;
		nextStart = end;
	}
	yield chunk(nextStart, expression.equalsGreaterThanToken.pos - 1);
	yield `] = __VLS_getSlotParameters(${slotVar}!`;

	if (types.some(t => t)) {
		yield `, `;
		yield* wrapWith(
			exp.loc.start.offset,
			exp.loc.end.offset,
			codeFeatures.verification,
			`(`,
			...types.flatMap(type => type ? [`_: `, type, `, `] : `_, `),
			`) => [] as any`,
		);
	}
	yield `)${endOfLine}`;

	function chunk(start: number, end: number): Code {
		return [
			ast.text.slice(start, end),
			'template',
			startOffset + start,
			codeFeatures.all,
		];
	}
}
