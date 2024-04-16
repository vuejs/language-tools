import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript';
import type { Code, Sfc, VueCodeInformation, VueCompilerOptions } from "../../types";
import { hyphenateTag } from '../../utils/shared';
import { endOfLine, newLine, variableNameRegex, wrapWith } from "../common";
import { generateCamelized } from './camelized';
import { getCanonicalComponentName, getPossibleOriginalComponentNames } from './element';
import { generateObjectProperty } from './objectProperty';
import { generatePropertyAccess } from './propertyAccess';
import { generateStringLiteralKey } from './stringLiteralKey';
import { generateTemplateNode, getVForNode } from './templateNode';

const _codeFeatures = {
	all: {
		verification: true,
		completion: true,
		semantic: true,
		navigation: true,
	} as VueCodeInformation,
	verification: {
		verification: true,
	} as VueCodeInformation,
	completion: {
		completion: true,
	} as VueCodeInformation,
	additionalCompletion: {
		completion: { isAdditional: true },
	} as VueCodeInformation,
	navigation: {
		navigation: true,
	} as VueCodeInformation,
	navigationAndCompletion: {
		navigation: true,
	} as VueCodeInformation,
	withoutHighlight: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		navigation: true,
		completion: true,
	} as VueCodeInformation,
	withoutHighlightAndCompletion: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		navigation: true,
	} as VueCodeInformation,
	withoutHighlightAndCompletionAndNavigation: {
		semantic: { shouldHighlight: () => false },
		verification: true,
	} as VueCodeInformation,
};

export type TemplateCodegenContext = ReturnType<typeof createTemplateCodegenContext>;

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

export function* generate(options: TemplateCodegenOptions) {
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
		yield* generateTemplateNode(options, ctx, options.template.ast, undefined, undefined, undefined);
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

export function createTemplateCodegenContext() {
	let ignoredError = false;
	let expectErrorToken: {
		errors: number;
		node: CompilerDOM.CommentNode;
	} | undefined;
	let variableId = 0;

	const codeFeatures = new Proxy(_codeFeatures, {
		get(target, key: keyof typeof _codeFeatures) {
			const data = target[key];
			if (data.verification) {
				if (ignoredError) {
					return {
						...data,
						verification: false,
					};
				}
				if (expectErrorToken) {
					const token = expectErrorToken;
					if (typeof data.verification !== 'object' || !data.verification.shouldReport) {
						return {
							...data,
							verification: {
								shouldReport: () => {
									token.errors++;
									return false;
								},
							},
						};
					}
				}
			}
			return data;
		},
	});
	const localVars = new Map<string, number>();
	const accessGlobalVariables = new Map<string, Set<number>>();
	const slots: {
		name: string;
		loc?: number;
		tagRange: [number, number];
		varName: string;
		nodeLoc: any;
	}[] = [];
	const dynamicSlots: {
		expVar: string;
		varName: string;
	}[] = [];
	const hasSlotElements = new Set<CompilerDOM.ElementNode>();;
	const blockConditions: string[] = [];
	const usedComponentCtxVars = new Set<string>();
	const scopedClasses: { className: string, offset: number; }[] = [];

	return {
		slots,
		dynamicSlots,
		codeFeatures,
		accessGlobalVariables,
		hasSlotElements,
		blockConditions,
		usedComponentCtxVars,
		scopedClasses,
		accessGlobalVariable(name: string, offset?: number) {
			let arr = accessGlobalVariables.get(name);
			if (!arr) {
				accessGlobalVariables.set(name, arr = new Set());
			}
			if (offset !== undefined) {
				arr.add(offset);
			}
		},
		hasLocalVariable: (name: string) => {
			return !!localVars.get(name);
		},
		addLocalVariable: (name: string) => {
			localVars.set(name, (localVars.get(name) ?? 0) + 1);
		},
		removeLocalVariable: (name: string) => {
			localVars.set(name, localVars.get(name)! - 1);
		},
		getInternalVariable: () => {
			return `__VLS_${variableId++}`;
		},
		ignoreError: function* (): Generator<Code> {
			if (!ignoredError) {
				ignoredError = true;
				yield `// @vue-ignore start${newLine}`;
			}
		},
		expectError: function* (prevNode: CompilerDOM.CommentNode): Generator<Code> {
			if (!expectErrorToken) {
				expectErrorToken = {
					errors: 0,
					node: prevNode,
				};
				yield `// @vue-expect-error start${newLine}`;
			}
		},
		resetDirectiveComments: function* (endStr: string): Generator<Code> {
			if (expectErrorToken) {
				const token = expectErrorToken;
				yield* wrapWith(
					expectErrorToken.node.loc.start.offset,
					expectErrorToken.node.loc.end.offset,
					{
						verification: {
							shouldReport: () => token.errors === 0,
						},
					},
					`// @ts-expect-error __VLS_TS_EXPECT_ERROR`,
				);
				yield `${newLine}${endOfLine}`;
				expectErrorToken = undefined;
				yield `// @vue-expect-error ${endStr}${newLine}`;
			}
			if (ignoredError) {
				ignoredError = false;
				yield `// @vue-ignore ${endStr}${newLine}`;
			}
		},
		generateAutoImportCompletion: function* (): Generator<Code> {
			const all = [...accessGlobalVariables.entries()];
			if (!all.some(([_, offsets]) => offsets.size)) {
				yield `// no auto imports${endOfLine}`;
				return;
			}
			yield `// @ts-ignore${newLine}`; // #2304
			yield `[`;
			for (const [varName, offsets] of all) {
				for (const offset of offsets) {
					yield [
						varName,
						'template',
						offset,
						codeFeatures.additionalCompletion,
					];
					yield `,`;
				}
				offsets.clear();
			}
			yield `]${endOfLine}`;
		}
	};
}

export function isFragment(node: CompilerDOM.IfNode | CompilerDOM.ForNode) {
	return node.codegenNode && 'consequent' in node.codegenNode && 'tag' in node.codegenNode.consequent && node.codegenNode.consequent.tag === CompilerDOM.FRAGMENT;
}
