import * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { collectVars, createTsAst, endOfLine, newLine, wrapWith } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateObjectProperty } from './objectProperty';
import { generateTemplateChild } from './templateChild';

export function* generateTemplateSlot(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	slotDir: CompilerDOM.DirectiveNode,
	currentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string
): Generator<Code> {
	const slotBlockVars: string[] = [];
	ctx.usedComponentCtxVars.add(componentCtxVar);
	if (currentComponent) {
		ctx.hasSlotElements.add(currentComponent);
	}
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
	yield `: __VLS_thisSlot } = ${componentCtxVar}.slots!${endOfLine}`;

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
			yield `] = __VLS_getSlotParams(__VLS_thisSlot)${endOfLine}`;
		}
		else {
			yield `const `;
			yield [
				slotDir.exp.content,
				'template',
				slotDir.exp.loc.start.offset,
				ctx.codeFeatures.all,
			];
			yield ` = __VLS_getSlotParam(__VLS_thisSlot)${endOfLine}`;
		}
	}

	for (const varName of slotBlockVars) {
		ctx.addLocalVariable(varName);
	}

	yield* ctx.resetDirectiveComments('end of slot children start');

	let prev: CompilerDOM.TemplateChildNode | undefined;
	for (const childNode of node.children) {
		yield* generateTemplateChild(options, ctx, childNode, currentComponent, prev, componentCtxVar);
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
		yield `${componentCtxVar}.slots!['`;
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
