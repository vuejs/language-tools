import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { endOfLine, newLine, wrapWith } from '../common';
import { createTemplateCodegenContext } from './context';
import { getCanonicalComponentName, getPossibleOriginalComponentNames } from './element';
import { generateObjectProperty } from './objectProperty';
import { generateStringLiteralKey } from './stringLiteralKey';
import { generateTemplateChild, getVForNode } from './templateChild';

export interface TemplateCodegenOptions {
	ts: typeof ts;
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
	template: NonNullable<Sfc['template']>;
	shouldGenerateScopedClasses?: boolean;
	stylesScopedClasses: Set<string>;
	scriptSetupBindingNames: Set<string>;
	scriptSetupImportComponentNames: Set<string>;
	hasDefineSlots?: boolean;
	slotsAssignName?: string;
	propsAssignName?: string;
}

export function* generateTemplate(options: TemplateCodegenOptions): Generator<Code> {
	const ctx = createTemplateCodegenContext(options.scriptSetupBindingNames);

	let hasSlot = false;

	if (options.slotsAssignName) {
		ctx.addLocalVariable(options.slotsAssignName);
	}
	if (options.propsAssignName) {
		ctx.addLocalVariable(options.propsAssignName);
	}

	yield* generatePreResolveComponents();

	if (options.template.ast) {
		yield* generateTemplateChild(options, ctx, options.template.ast, undefined, undefined, undefined);
	}

	yield* generateStyleScopedClasses();

	if (!options.hasDefineSlots) {
		yield `var __VLS_slots!:`;
		yield* generateSlotsType();
		yield endOfLine;
	}

	yield* ctx.generateAutoImportCompletion();

	return {
		ctx,
		hasSlot,
	};

	function* generateSlotsType(): Generator<Code> {
		for (const { expVar, varName } of ctx.dynamicSlots) {
			hasSlot = true;
			yield `Partial<Record<NonNullable<typeof ${expVar}>, (_: typeof ${varName}) => any>> &${newLine}`;
		}
		yield `{${newLine}`;
		for (const slot of ctx.slots) {
			hasSlot = true;
			if (slot.name && slot.loc !== undefined) {
				yield* generateObjectProperty(
					options,
					ctx,
					slot.name,
					slot.loc,
					{
						...ctx.codeFeatures.withoutHighlightAndCompletion,
						__referencesCodeLens: true,
					},
					slot.nodeLoc
				);
			}
			else {
				yield* wrapWith(
					slot.tagRange[0],
					slot.tagRange[1],
					{
						...ctx.codeFeatures.withoutHighlightAndCompletion,
						__referencesCodeLens: true,
					},
					`default`,
				);
			}
			yield `?(_: typeof ${slot.varName}): any,${newLine}`;
		}
		yield `}`;
	}

	function* generateStyleScopedClasses(): Generator<Code> {
		yield `if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {${newLine}`;
		for (const { className, offset } of ctx.scopedClasses) {
			yield `__VLS_styleScopedClasses[`;
			yield* generateStringLiteralKey(
				className,
				offset,
				{
					...ctx.codeFeatures.navigationAndCompletion,
					__displayWithLink: options.stylesScopedClasses.has(className),
				},
			);
			yield `]${endOfLine}`;
		}
		yield `}${newLine}`;
	}

	function* generatePreResolveComponents(): Generator<Code> {
		yield `let __VLS_resolvedLocalAndGlobalComponents!: {}`;
		if (options.template.ast) {
			for (const node of forEachElementNode(options.template.ast)) {
				if (
					node.tagType === CompilerDOM.ElementTypes.COMPONENT
					&& node.tag.toLowerCase() !== 'component'
					&& !node.tag.includes('.') // namespace tag 
				) {
					yield ` & __VLS_WithComponent<'${getCanonicalComponentName(node.tag)}', typeof __VLS_localComponents, `;
					yield getPossibleOriginalComponentNames(node.tag, false)
						.map(name => `"${name}"`)
						.join(', ');
					yield `>`;
				}
			}
		}
		yield endOfLine;
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

export function isFragment(node: CompilerDOM.IfNode | CompilerDOM.ForNode) {
	return node.codegenNode && 'consequent' in node.codegenNode && 'tag' in node.codegenNode.consequent && node.codegenNode.consequent.tag === CompilerDOM.FRAGMENT;
}
