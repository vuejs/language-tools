import type { Mapping } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { getSlotsPropertyName } from '../../utils/shared';
import { endOfLine, newLine, wrapWith } from '../utils';
import { generateStringLiteralKey } from '../utils/stringLiteralKey';
import { TemplateCodegenContext, createTemplateCodegenContext } from './context';
import { getCanonicalComponentName, getPossibleOriginalComponentNames } from './element';
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
	getGeneratedLength: () => number;
	linkedCodeMappings: Mapping[];
}

export function* generateTemplate(options: TemplateCodegenOptions): Generator<Code, TemplateCodegenContext> {
	const ctx = createTemplateCodegenContext(options);

	if (options.slotsAssignName) {
		ctx.addLocalVariable(options.slotsAssignName);
	}
	if (options.propsAssignName) {
		ctx.addLocalVariable(options.propsAssignName);
	}
	// TODO: circular reference
	// ctx.addLocalVariable('$attrs');
	ctx.addLocalVariable(getSlotsPropertyName(options.vueCompilerOptions.target));
	ctx.addLocalVariable('$refs');
	ctx.addLocalVariable('$el');

	yield* generatePreResolveComponents(options);

	if (options.template.ast) {
		yield* generateTemplateChild(options, ctx, options.template.ast, undefined, undefined, undefined);
	}

	yield* generateStyleScopedClassReferences(ctx);
	yield* generateSlots(options, ctx);
	yield* generateInheritedAttrs(options, ctx);
	yield* generateRefs(options, ctx);
	yield* generateRootEl(options, ctx);

	yield* ctx.generateAutoImportCompletion();
	return ctx;
}

function* generateSlots(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext
): Generator<Code> {
	if (!options.hasDefineSlots) {
		yield `var __VLS_slots!: `;
		for (const { expVar, varName } of ctx.dynamicSlots) {
			ctx.hasSlot = true;
			yield `Partial<Record<NonNullable<typeof ${expVar}>, (_: typeof ${varName}) => any>> &${newLine}`;
		}
		yield `{${newLine}`;
		for (const slot of ctx.slots) {
			ctx.hasSlot = true;
			if (slot.name && slot.loc !== undefined) {
				yield* generateObjectProperty(
					options,
					ctx,
					slot.name,
					slot.loc,
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
			yield `?(_: typeof ${slot.varName}): any,${newLine}`;
		}
		yield `}${endOfLine}`;
	}
	const name = getSlotsPropertyName(options.vueCompilerOptions.target);
	yield* generateContextVariable(options, name, options.slotsAssignName ?? `__VLS_slots`);
}

function* generateInheritedAttrs(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext
): Generator<Code> {
	yield 'let __VLS_inheritedAttrs!: {}';
	for (const varName of ctx.inheritedAttrVars) {
		yield ` & typeof ${varName}`;
	}
	yield endOfLine;
	yield* generateContextVariable(options, `$attrs`, `Partial<typeof __VLS_inheritedAttrs> & Record<string, unknown>`);
}

function* generateRefs(
	options: TemplateCodegenOptions,
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
	yield* generateContextVariable(options, `$refs`, `typeof __VLS_refs`);
}

function* generateRootEl(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext
): Generator<Code> {
	yield* generateContextVariable(options, `$el`, ctx.singleRootElType ?? `any`);
}

function* generateContextVariable(
	options: TemplateCodegenOptions,
	varName: string,
	typeExp: string
): Generator<Code> {
	yield `/** @type { typeof __VLS_ctx.`;
	const sourceOffset = options.getGeneratedLength();
	yield `${varName} } */${endOfLine}`;
	yield `var `;
	const generatedOffset = options.getGeneratedLength();
	yield `${varName}!: ${typeExp}${endOfLine}`;

	options.linkedCodeMappings.push({
		sourceOffsets: [sourceOffset],
		generatedOffsets: [generatedOffset],
		lengths: [varName.length],
		data: undefined,
	});
}

function* generatePreResolveComponents(options: TemplateCodegenOptions): Generator<Code> {
	yield `let __VLS_resolvedLocalAndGlobalComponents!: Required<{}`;
	if (options.template.ast) {
		const components = new Set<string>();
		for (const node of forEachElementNode(options.template.ast)) {
			if (
				node.tagType === CompilerDOM.ElementTypes.COMPONENT
				&& node.tag.toLowerCase() !== 'component'
				&& !node.tag.includes('.') // namespace tag 
			) {
				if (components.has(node.tag)) {
					continue;
				}
				components.add(node.tag);
				yield newLine;
				yield ` & __VLS_WithComponent<'${getCanonicalComponentName(node.tag)}', __VLS_LocalComponents, `;
				yield getPossibleOriginalComponentNames(node.tag, false)
					.map(name => `'${name}'`)
					.join(', ');
				yield `>`;
			}
		}
	}
	yield `>${endOfLine}`;
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
