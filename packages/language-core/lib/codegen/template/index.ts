import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript';
import type { Code, Sfc, VueCodeInformation, VueCompilerOptions } from '../../types';
import { hyphenateTag } from '../../utils/shared';
import { endOfLine, newLine, variableNameRegex, wrapWith } from '../common';
import { generateCamelized } from './camelized';
import { createTemplateCodegenContext } from './context';
import { getCanonicalComponentName, getPossibleOriginalComponentNames } from './element';
import { generateObjectProperty } from './objectProperty';
import { generatePropertyAccess } from './propertyAccess';
import { generateStringLiteralKey } from './stringLiteralKey';
import { generateTemplateChild, getVForNode } from './templateChild';

export interface TemplateCodegenOptions {
	ts: typeof ts;
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
	template: NonNullable<Sfc['template']>;
	shouldGenerateScopedClasses?: boolean;
	stylesScopedClasses: Set<string>;
	hasDefineSlots?: boolean;
	slotsAssignName?: string;
	propsAssignName?: string;
}

export function* generateTemplate(options: TemplateCodegenOptions) {
	const ctx = createTemplateCodegenContext();
	const { componentTagNameOffsets, elementTagNameOffsets } = collectTagOffsets();

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

	function collectTagOffsets() {

		const componentTagNameOffsets = new Map<string, number[]>();
		const elementTagNameOffsets = new Map<string, number[]>();

		if (!options.template.ast) {
			return {
				componentTagNameOffsets,
				elementTagNameOffsets,
			};
		}

		for (const node of forEachElementNode(options.template.ast)) {
			if (node.tagType === CompilerDOM.ElementTypes.SLOT) {
				// ignore
				continue;
			}
			if (node.tag === 'component' || node.tag === 'Component') {
				// ignore
				continue;
			}
			const map = node.tagType === CompilerDOM.ElementTypes.COMPONENT
				? componentTagNameOffsets
				: elementTagNameOffsets;
			let offsets = map.get(node.tag);
			if (!offsets) {
				map.set(node.tag, offsets = []);
			}
			const source = options.template.content.substring(node.loc.start.offset);
			const startTagOffset = node.loc.start.offset + source.indexOf(node.tag);

			offsets.push(startTagOffset); // start tag
			if (!node.isSelfClosing && options.template.lang === 'html') {
				const endTagOffset = node.loc.start.offset + node.loc.source.lastIndexOf(node.tag);
				if (endTagOffset !== startTagOffset) {
					offsets.push(endTagOffset); // end tag
				}
			}
		}

		return {
			componentTagNameOffsets,
			elementTagNameOffsets,
		};
	}

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

		for (const [tagName] of componentTagNameOffsets) {

			const isNamespacedTag = tagName.includes('.');
			if (isNamespacedTag) {
				continue;
			}

			yield ` & __VLS_WithComponent<'${getCanonicalComponentName(tagName)}', typeof __VLS_localComponents, `;
			yield getPossibleOriginalComponentNames(tagName, false)
				.map(name => `"${name}"`)
				.join(', ');
			yield `>`;
		}

		yield endOfLine;

		for (const [tagName, offsets] of elementTagNameOffsets) {
			for (const tagOffset of offsets) {
				yield `__VLS_intrinsicElements`;
				yield* generatePropertyAccess(
					options,
					ctx,
					tagName,
					tagOffset,
					ctx.codeFeatures.withoutHighlightAndCompletion,
				);
				yield `;`;
			}
			yield `${newLine}`;
		}

		for (const [tagName, offsets] of componentTagNameOffsets) {
			if (!variableNameRegex.test(camelize(tagName))) {
				continue;
			}
			for (const tagOffset of offsets) {
				for (const shouldCapitalize of (tagName[0] === tagName[0].toUpperCase() ? [false] : [true, false])) {
					const expectName = shouldCapitalize ? capitalize(camelize(tagName)) : camelize(tagName);
					yield `__VLS_components.`;
					yield* generateCamelized(
						shouldCapitalize ? capitalize(tagName) : tagName,
						tagOffset,
						{
							navigation: {
								resolveRenameNewName: tagName !== expectName ? camelizeComponentName : undefined,
								resolveRenameEditText: getTagRenameApply(tagName),
							},
						} as VueCodeInformation,
					);
					yield `;`;
				}
			}
			yield `${newLine}`;
			yield `// @ts-ignore${newLine}`; // #2304
			yield `[`;
			for (const tagOffset of offsets) {
				yield* generateCamelized(
					capitalize(tagName),
					tagOffset,
					{
						completion: {
							isAdditional: true,
							onlyImport: true,
						},
					} as VueCodeInformation,
				);
				yield `,`;
			}
			yield `]${endOfLine}`;
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

function camelizeComponentName(newName: string) {
	return camelize('-' + newName);
}

function getTagRenameApply(oldName: string) {
	return oldName === hyphenateTag(oldName) ? hyphenateTag : undefined;
}

export function isFragment(node: CompilerDOM.IfNode | CompilerDOM.ForNode) {
	return node.codegenNode && 'consequent' in node.codegenNode && 'tag' in node.codegenNode.consequent && node.codegenNode.consequent.tag === CompilerDOM.FRAGMENT;
}
