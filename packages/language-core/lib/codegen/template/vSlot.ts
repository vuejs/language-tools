import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code } from '../../types';
import { getStartEnd } from '../../utils/shared';
import { collectVars, createTsAst, endOfLine, newLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';
import type { TemplateCodegenContext } from './context';
import { generateElementChildren } from './elementChildren';
import type { TemplateCodegenOptions } from './index';
import { generateObjectProperty } from './objectProperty';

export function* generateVSlot(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	slotDir: CompilerDOM.DirectiveNode | undefined
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
					slotDir.arg.isStatic ? ctx.codeFeatures.withoutHighlight : ctx.codeFeatures.all,
					slotDir.arg.loc,
					false,
					true
				);
			}
			else {
				yield* wrapWith(
					slotDir.loc.start.offset,
					slotDir.loc.start.offset + (slotDir.rawName?.length ?? 0),
					ctx.codeFeatures.withoutHighlightAndCompletion,
					`default`
				);
			}
		}
		else {
			// #932: reference for implicit default slot
			const { start, end } = getElementInnerLoc(options, node);
			yield* wrapWith(
				start,
				end,
				ctx.codeFeatures.navigation,
				`default`
			);
		}
		yield `: ${slotVar} } = ${ctx.currentComponent.ctxVar}.slots!${endOfLine}`;
	}

	if (slotDir?.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const slotAst = createTsAst(options.ts, slotDir, `(${slotDir.exp.content}) => {}`);
		collectVars(options.ts, slotAst, slotAst, slotBlockVars);
		yield* generateSlotParameters(options, ctx, slotAst, slotDir.exp, slotVar);
	}

	for (const varName of slotBlockVars) {
		ctx.addLocalVariable(varName);
	}

	yield* generateElementChildren(options, ctx, node.children);

	for (const varName of slotBlockVars) {
		ctx.removeLocalVariable(varName);
	}

	if (options.vueCompilerOptions.strictSlotChildren && node.children.length) {
		const { start, end } = getElementInnerLoc(options, node);
		yield `(): __VLS_NormalizeSlotReturns<typeof ${slotVar}> => (`;
		yield* wrapWith(
			start,
			end,
			ctx.codeFeatures.verification,
			`{} as [`,
			...ctx.currentComponent.childTypes.map(name => `${name}, `),
			`]`
		);
		yield `)${endOfLine}`;
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
				ctx.codeFeatures.completion,
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
	slotVar: string
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
	yield `] = __VLS_getSlotParameters(${slotVar}`;

	if (types.some(t => t)) {
		yield `, `;
		yield* wrapWith(
			exp.loc.start.offset,
			exp.loc.end.offset,
			ctx.codeFeatures.verification,
			`(`,
			...types.flatMap(type => type ? [`_: `, type, `, `] : `_, `),
			`) => [] as any`
		);
	}
	yield `)${endOfLine}`;

	function chunk(start: number, end: number): Code {
		return [
			ast.text.slice(start, end),
			'template',
			startOffset + start,
			ctx.codeFeatures.all,
		];
	}
}

function getElementInnerLoc(
	options: TemplateCodegenOptions,
	node: CompilerDOM.ElementNode
) {
	if (node.children.length) {
		let start = node.children[0].loc.start.offset;
		let end = node.children.at(-1)!.loc.end.offset;
		while (options.template.content[start - 1] !== '>') {
			start--;
		}
		while (options.template.content[end] !== '<' && end < node.loc.end.offset) {
			end++;
		}
		return {
			start,
			end,
		};
	}
	else {
		return {
			start: node.loc.start.offset,
			end: node.loc.end.offset,
		};
	}
}
