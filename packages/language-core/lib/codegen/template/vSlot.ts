import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code } from '../../types';
import { collectVars, createTsAst, endOfLine, newLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateObjectProperty } from './objectProperty';
import { generateTemplateChild } from './templateChild';

export function* generateVSlot(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	slotDir: CompilerDOM.DirectiveNode
): Generator<Code> {
	if (!ctx.currentComponent) {
		return;
	}
	ctx.currentComponent.used = true;
	const slotBlockVars: string[] = [];
	yield `{${newLine}`;

	yield `const { `;
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
	yield `: __VLS_slot } = ${ctx.currentComponent.ctxVar}.slots!${endOfLine}`;

	if (slotDir.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const slotAst = createTsAst(options.ts, slotDir, `(${slotDir.exp.content}) => {}`);
		collectVars(options.ts, slotAst, slotAst, slotBlockVars);
		yield* generateSlotParameters(options, ctx, slotAst, slotDir.exp);
	}

	for (const varName of slotBlockVars) {
		ctx.addLocalVariable(varName);
	}

	yield* ctx.resetDirectiveComments('end of slot children start');

	let prev: CompilerDOM.TemplateChildNode | undefined;
	for (const childNode of node.children) {
		yield* generateTemplateChild(options, ctx, childNode, prev);
		prev = childNode;
	}

	for (const varName of slotBlockVars) {
		ctx.removeLocalVariable(varName);
	}

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

	yield* ctx.generateAutoImportCompletion();
	yield `}${newLine}`;
}

function* generateSlotParameters(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	ast: ts.SourceFile,
	exp: CompilerDOM.SimpleExpressionNode
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
			types.push(chunk(type.getStart(ast), type.end));
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
	yield `] = __VLS_getSlotParameters(__VLS_slot`;

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

export function* generateImplicitDefaultSlot(
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode
) {
	if (!ctx.currentComponent) {
		return;
	}
	if (node.children.length) {
		ctx.currentComponent.used = true;
		yield `${ctx.currentComponent.ctxVar}.slots!.`;
		yield* wrapWith(
			node.children[0].loc.start.offset,
			node.children[node.children.length - 1].loc.end.offset,
			ctx.codeFeatures.navigation,
			`default`
		);
		yield endOfLine;
	}
}
