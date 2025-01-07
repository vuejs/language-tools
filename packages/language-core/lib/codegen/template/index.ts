import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { getSlotsPropertyName } from '../../utils/shared';
import { endOfLine, newLine, wrapWith } from '../utils';
import { generateStringLiteralKey } from '../utils/stringLiteralKey';
import { TemplateCodegenContext, createTemplateCodegenContext } from './context';
import { generateObjectProperty } from './objectProperty';
import { generateStyleScopedClassReferences } from './styleScopedClasses';
import { generateTemplateChild, getVForNode } from './templateChild';

export interface TemplateCodegenOptions {
	ts: typeof ts;
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
	template: NonNullable<Sfc['template']>;
	edited: boolean;
	scriptSetupBindingNames: Set<string>;
	scriptSetupImportComponentNames: Set<string>;
	destructuredPropNames: Set<string>;
	templateRefNames: Set<string>;
	hasDefineSlots?: boolean;
	slotsAssignName?: string;
	propsAssignName?: string;
	inheritAttrs: boolean;
	selfComponentName?: string;
}

export function* generateTemplate(options: TemplateCodegenOptions): Generator<Code, TemplateCodegenContext> {
	const ctx = createTemplateCodegenContext(options);

	if (options.slotsAssignName) {
		ctx.addLocalVariable(options.slotsAssignName);
	}
	if (options.propsAssignName) {
		ctx.addLocalVariable(options.propsAssignName);
	}
	const slotsPropertyName = getSlotsPropertyName(options.vueCompilerOptions.target);
	ctx.specialVars.add(slotsPropertyName);
	ctx.specialVars.add('$attrs');
	ctx.specialVars.add('$refs');
	ctx.specialVars.add('$el');

	if (options.template.ast) {
		yield* generateTemplateChild(options, ctx, options.template.ast, undefined);
	}

	yield* generateStyleScopedClassReferences(ctx);
	const speicalTypes = [
		[slotsPropertyName, yield* generateSlots(options, ctx)],
		['$attrs', yield* generateInheritedAttrs(ctx)],
		['$refs', yield* generateRefs(ctx)],
		['$el', yield* generateRootEl(ctx)]
	];

	yield `var __VLS_special!: {${newLine}`;
	for (const [name, type] of speicalTypes) {
		yield `${name}: ${type}${endOfLine}`;
	}
	yield `} & { [K in keyof typeof __VLS_ctx]: unknown }${endOfLine}`;

	yield* ctx.generateAutoImportCompletion();
	return ctx;
}

function* generateSlots(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext
): Generator<Code> {
	const name = getSlotsPropertyName(options.vueCompilerOptions.target);
	if (!options.hasDefineSlots) {
		yield `var __VLS_slots!: `;
		for (const { expVar, propsVar } of ctx.dynamicSlots) {
			ctx.hasSlot = true;
			yield `Partial<Record<NonNullable<typeof ${expVar}>, (props: typeof ${propsVar}) => any>> &${newLine}`;
		}
		yield `{${newLine}`;
		for (const slot of ctx.slots) {
			ctx.hasSlot = true;
			if (slot.name && slot.offset !== undefined) {
				yield* generateObjectProperty(
					options,
					ctx,
					slot.name,
					slot.offset,
					ctx.codeFeatures.withoutHighlightAndCompletion,
					slot.nodeLoc
				);
			}
			else {
				yield* wrapWith(
					slot.tagRange[0],
					slot.tagRange[1],
					ctx.codeFeatures.withoutHighlightAndCompletion,
					`default`
				);
			}
			yield `?(props: typeof ${slot.propsVar}): any,${newLine}`;
		}
		yield `}${endOfLine}`;
	}
	return `__VLS_OmitStringIndex<typeof __VLS_ctx.${name}> & typeof ${options.slotsAssignName ?? `__VLS_slots`}`;
}

function* generateInheritedAttrs(
	ctx: TemplateCodegenContext
): Generator<Code> {
	yield 'let __VLS_inheritedAttrs!: {}';
	for (const varName of ctx.inheritedAttrVars) {
		yield ` & typeof ${varName}`;
	}
	yield endOfLine;

	if (ctx.bindingAttrLocs.length) {
		yield `[`;
		for (const loc of ctx.bindingAttrLocs) {
			yield `__VLS_special.`;
			yield [
				loc.source,
				'template',
				loc.start.offset,
				ctx.codeFeatures.all
			];
			yield `,`;
		}
		yield `]${endOfLine}`;
	}
	return `typeof __VLS_ctx.$attrs & Partial<typeof __VLS_inheritedAttrs>`;
}

function* generateRefs(
	ctx: TemplateCodegenContext
): Generator<Code> {
	yield `const __VLS_refs = {${newLine}`;
	for (const [name, [varName, offset]] of ctx.templateRefs) {
		yield* generateStringLiteralKey(
			name,
			offset,
			ctx.codeFeatures.navigationAndCompletion
		);
		yield `: ${varName},${newLine}`;
	}
	yield `}${endOfLine}`;
	return `typeof __VLS_refs`;
}

function* generateRootEl(
	ctx: TemplateCodegenContext
): Generator<Code> {
	yield `let __VLS_rootEl!: `;
	yield ctx.singleRootElType ?? `any`;
	yield endOfLine;
	return `typeof __VLS_rootEl`;
}

export function* forEachElementNode(node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode): Generator<CompilerDOM.ElementNode> {
	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		for (const child of node.children) {
			yield* forEachElementNode(child);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		const patchForNode = getVForNode(node);
		if (patchForNode) {
			yield* forEachElementNode(patchForNode);
		}
		else {
			yield node;
			for (const child of node.children) {
				yield* forEachElementNode(child);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.IF) {
		// v-if / v-else-if / v-else
		for (let i = 0; i < node.branches.length; i++) {
			const branch = node.branches[i];
			for (const childNode of branch.children) {
				yield* forEachElementNode(childNode);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.FOR) {
		// v-for
		for (const child of node.children) {
			yield* forEachElementNode(child);
		}
	}
}
