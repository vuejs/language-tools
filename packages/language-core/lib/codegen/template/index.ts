import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { endOfLine, newLine, wrapWith } from '../common';
import { TemplateCodegenContext, createTemplateCodegenContext } from './context';
import { getCanonicalComponentName, getPossibleOriginalComponentNames } from './element';
import { generateObjectProperty } from './objectProperty';
import { generateTemplateChild, getVForNode } from './templateChild';
import { generateStyleScopedClasses } from './styleScopedClasses';

export interface TemplateCodegenOptions {
	ts: typeof ts;
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
	template: NonNullable<Sfc['template']>;
	scriptSetupBindingNames: Set<string>;
	scriptSetupImportComponentNames: Set<string>;
	templateRefNames: Map<string, string>;
	hasDefineSlots?: boolean;
	slotsAssignName?: string;
	propsAssignName?: string;
	inheritAttrs: boolean;
}

export function* generateTemplate(options: TemplateCodegenOptions): Generator<Code, TemplateCodegenContext> {
	const ctx = createTemplateCodegenContext(options.scriptSetupBindingNames);

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

	yield* generateStyleScopedClasses(ctx);

	if (!options.hasDefineSlots) {
		yield `var __VLS_slots!:`;
		yield* generateSlotsType();
		yield endOfLine;
	}

	yield* generateInheritedAttrs();

	yield* ctx.generateAutoImportCompletion();

	yield* generateRefs()

	return ctx;

	function* generateRefs(): Generator<Code> {
		for (const [, validId] of options.templateRefNames) {
			yield `let ${validId}${newLine}`;
		}
		yield `const __VLS_refs = {${newLine}`;
		for (const [name, validId] of options.templateRefNames) {
			yield `'${name}': ${validId}!,${newLine}`;
		}
		yield `}${endOfLine}`;
	}

	function* generateSlotsType(): Generator<Code> {
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
		yield `}`;
	}

	function* generateInheritedAttrs(): Generator<Code> {
		yield 'var __VLS_inheritedAttrs!: {}';
		for (const varName of ctx.inheritedAttrVars) {
			yield ` & typeof ${varName}`;
		}
		yield endOfLine;
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
