import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { endOfLine, newLine, wrapWith } from '../common';
import { TemplateCodegenContext, createTemplateCodegenContext } from './context';
import { getCanonicalComponentName, getPossibleOriginalComponentNames } from './element';
import { generateObjectProperty } from './objectProperty';
import { generateTemplateChild, getVForNode } from './templateChild';

export interface TemplateCodegenOptions {
	ts: typeof ts;
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
	template: NonNullable<Sfc['template']>;
	scriptSetupBindingNames: Set<string>;
	scriptSetupImportComponentNames: Set<string>;
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

	yield* generateStyleScopedClasses();

	if (!options.hasDefineSlots) {
		yield `var __VLS_slots!:`;
		yield* generateSlotsType();
		yield endOfLine;
	}

	yield* generateInheritedAttrs();

	yield* ctx.generateAutoImportCompletion();

	return ctx;

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

	function* generateStyleScopedClasses(): Generator<Code> {
		yield `if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {${newLine}`;
		for (const offset of ctx.emptyClassOffsets) {
			yield `__VLS_styleScopedClasses['`;
			yield [
				'',
				'template',
				offset,
				ctx.codeFeatures.additionalCompletion,
			];
			yield `']${endOfLine}`;
		}
		for (const { className, offset } of ctx.scopedClasses) {
			yield `__VLS_styleScopedClasses[`;
			yield [
				'',
				'template',
				offset,
				ctx.codeFeatures.navigationWithoutRename,
			];
			yield `'`;

			// fix https://github.com/vuejs/language-tools/issues/4537
			yield* escapeString(className, offset, ['\\', '\'']);
			yield `'`;
			yield [
				'',
				'template',
				offset + className.length,
				ctx.codeFeatures.navigationWithoutRename,
			];
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

	function* escapeString(className: string, offset: number, escapeTargets: string[]): Generator<Code> {
		let count = 0;

		const currentEscapeTargets = [...escapeTargets];
		const firstEscapeTarget = currentEscapeTargets.shift()!;
		const splitted = className.split(firstEscapeTarget);

		for (let i = 0; i < splitted.length; i++) {
			const part = splitted[i];
			const partLength = part.length;

			if (escapeTargets.length > 0) {
				yield* escapeString(part, offset + count, [...currentEscapeTargets]);
			} else {
				yield [
					part,
					'template',
					offset + count,
					ctx.codeFeatures.navigationAndAdditionalCompletion,
				];
			}

			if (i !== splitted.length - 1) {
				yield '\\';

				yield [
					firstEscapeTarget,
					'template',
					offset + count + partLength,
					ctx.codeFeatures.navigationAndAdditionalCompletion,
				];

				count += partLength + 1;
			} else {
				count += partLength;
			}
		}
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
