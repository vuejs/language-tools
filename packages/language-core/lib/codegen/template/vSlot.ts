import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
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
			slotDir.arg.isStatic ? codeFeatures.withoutHighlight : codeFeatures.all,
			slotDir.arg.loc,
			false,
			true
		);
	}
	else {
		yield* wrapWith(
			slotDir.loc.start.offset,
			slotDir.loc.start.offset + (slotDir.rawName?.length ?? 0),
			codeFeatures.withoutHighlightAndCompletion,
			`default`
		);
	}
	yield `: __VLS_thisSlot } = ${ctx.currentComponent.ctxVar}.slots!${endOfLine}`;

	if (slotDir.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const slotAst = createTsAst(options.ts, slotDir, `(${slotDir.exp.content}) => {}`);
		collectVars(options.ts, slotAst, slotAst, slotBlockVars);
		if (!slotDir.exp.content.includes(':')) {
			yield `const [`;
			yield [
				slotDir.exp.content,
				'template',
				slotDir.exp.loc.start.offset,
				codeFeatures.all,
			];
			yield `] = __VLS_getSlotParams(__VLS_thisSlot)${endOfLine}`;
		}
		else {
			yield `const `;
			yield [
				slotDir.exp.content,
				'template',
				slotDir.exp.loc.start.offset,
				codeFeatures.all,
			];
			yield ` = __VLS_getSlotParam(__VLS_thisSlot)${endOfLine}`;
		}
	}

	for (const varName of slotBlockVars) {
		ctx.addLocalVariable(varName);
	}

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
			codeFeatures.completion,
		];
		yield `'/* empty slot name completion */]${endOfLine}`;
	}

	yield* ctx.generateAutoImportCompletion();
	yield `}${newLine}`;
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
			codeFeatures.navigation,
			`default`
		);
		yield endOfLine;
	}
}
