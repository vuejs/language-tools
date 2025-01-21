import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { collectVars, createTsAst, endOfLine, newLine, wrapWith } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateObjectProperty } from './objectProperty';
import { generateTemplateChild } from './templateChild';

export function* generateVSlot(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	slotDir: CompilerDOM.DirectiveNode | undefined
): Generator<Code> {
	if (!ctx.currentComponent) {
		return;
	}
	ctx.currentComponent.used = true;

	const slotBlockVars: string[] = [];
	const var_slot = ctx.getInternalVariable();

	if (slotDir || node.children.length) {
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
			yield* wrapWith(
				node.children[0].loc.start.offset,
				node.children.at(-1)!.loc.end.offset,
				ctx.codeFeatures.navigation,
				`default`
			);
		}
		yield `: ${var_slot} } = ${ctx.currentComponent.ctxVar}.slots!${endOfLine}`;
	}

	if (slotDir) {
		yield `{${newLine}`;
		if (slotDir.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			const slotAst = createTsAst(options.ts, slotDir, `(${slotDir.exp.content}) => {}`);
			collectVars(options.ts, slotAst, slotAst, slotBlockVars);
			if (!slotDir.exp.content.includes(':')) {
				yield `const [`;
				yield [
					slotDir.exp.content,
					'template',
					slotDir.exp.loc.start.offset,
					ctx.codeFeatures.all,
				];
				yield `] = __VLS_getSlotParams(${var_slot})${endOfLine}`;
			}
			else {
				yield `const `;
				yield [
					slotDir.exp.content,
					'template',
					slotDir.exp.loc.start.offset,
					ctx.codeFeatures.all,
				];
				yield ` = __VLS_getSlotParam(${var_slot})${endOfLine}`;
			}
		}
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

	if (node.children.length) {
		yield `(): __VLS_NormalizeSlotReturns<typeof ${var_slot}> => `;
		yield* wrapWith(
			node.children[0].loc.start.offset,
			node.children.at(-1)!.loc.end.offset,
			ctx.codeFeatures.verification,
			`[`,
			...ctx.currentComponent.childNodes.flatMap(({ name, start, end }) => [
				...wrapWith(
					start,
					end,
					ctx.codeFeatures.verification,
					name
				),
				`, `
			]),
			`]`
		);
		yield endOfLine;
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

	yield* ctx.generateAutoImportCompletion();
}
