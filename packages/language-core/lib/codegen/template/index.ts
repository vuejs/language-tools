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
}

export function* generateTemplate(options: TemplateCodegenOptions): Generator<Code, TemplateCodegenContext> {
	const ctx = createTemplateCodegenContext(options);

	if (options.slotsAssignName) {
		ctx.addLocalVariable(options.slotsAssignName);
	}
	if (options.propsAssignName) {
		ctx.addLocalVariable(options.propsAssignName);
	}
	ctx.addLocalVariable(getSlotsPropertyName(options.vueCompilerOptions.target));
	ctx.addLocalVariable('$attrs');
	ctx.addLocalVariable('$refs');
	ctx.addLocalVariable('$el');

	if (options.template.ast) {
		yield* generateTemplateChild(options, ctx, options.template.ast, undefined);
	}

	yield* generateStyleScopedClassReferences(ctx);
	yield* generateSlots(options, ctx);
	yield* generateInheritedAttrs(ctx);
	yield* generateRefs(ctx);
	yield* generateRootEl(ctx);

	yield* ctx.generateAutoImportCompletion();
	return ctx;
}

function* generateSlots(options: TemplateCodegenOptions, ctx: TemplateCodegenContext): Generator<Code> {
	const name = getSlotsPropertyName(options.vueCompilerOptions.target);

	if (!options.hasDefineSlots) {
		yield `var __VLS_slots!: __VLS_OmitStringIndex<typeof __VLS_ctx.${name}> & `;
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
	yield `var ${name}!: typeof ${options.slotsAssignName ?? '__VLS_slots'}${endOfLine}`;
}

function* generateInheritedAttrs(ctx: TemplateCodegenContext): Generator<Code> {
	yield 'let __VLS_inheritedAttrs!: {}';
	for (const varName of ctx.inheritedAttrVars) {
		yield ` & typeof ${varName}`;
	}
	yield endOfLine;
	yield `var $attrs!: Partial<typeof __VLS_inheritedAttrs> & Record<string, unknown>${endOfLine}`;

	if (ctx.bindingAttrLocs.length) {
		yield `[`;
		for (const loc of ctx.bindingAttrLocs) {
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
}

function* generateRefs(ctx: TemplateCodegenContext): Generator<Code> {
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
	yield `var $refs!: typeof __VLS_refs${endOfLine}`;
}

function* generateRootEl(ctx: TemplateCodegenContext): Generator<Code> {
	if (ctx.singleRootElType) {
		yield `var $el!: ${ctx.singleRootElType}${endOfLine}`;
	}
	else {
		yield `var $el!: any${endOfLine}`;
	}
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
