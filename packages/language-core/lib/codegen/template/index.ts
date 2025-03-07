import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { getSlotsPropertyName } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { endOfLine, newLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';
import { TemplateCodegenContext, createTemplateCodegenContext } from './context';
import { generateObjectProperty } from './objectProperty';
import { generateStyleScopedClassReferences } from './styleScopedClasses';
import { generateTemplateChild, getVForNode } from './templateChild';

export interface TemplateCodegenOptions {
	ts: typeof ts;
	compilerOptions: ts.CompilerOptions;
	vueCompilerOptions: VueCompilerOptions;
	template: NonNullable<Sfc['template']>;
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
	if (options.vueCompilerOptions.inferTemplateDollarSlots) {
		ctx.dollarVars.add(slotsPropertyName);
	}
	if (options.vueCompilerOptions.inferTemplateDollarAttrs) {
		ctx.dollarVars.add('$attrs');
	}
	if (options.vueCompilerOptions.inferTemplateDollarRefs) {
		ctx.dollarVars.add('$refs');
	}
	if (options.vueCompilerOptions.inferTemplateDollarEl) {
		ctx.dollarVars.add('$el');
	}

	if (options.template.ast) {
		yield* generateTemplateChild(options, ctx, options.template.ast, undefined);
	}

	yield* generateStyleScopedClassReferences(ctx);
	yield* ctx.generateAutoImportCompletion();
	yield* ctx.generateHoistVariables();

	const speicalTypes = [
		[slotsPropertyName, yield* generateSlots(options, ctx)],
		['$attrs', yield* generateInheritedAttrs(options, ctx)],
		['$refs', yield* generateTemplateRefs(options, ctx)],
		['$el', yield* generateRootEl(ctx)]
	];

	yield `var __VLS_dollars!: {${newLine}`;
	for (const [name, type] of speicalTypes) {
		yield `${name}: ${type}${endOfLine}`;
	}
	yield `} & { [K in keyof import('${options.vueCompilerOptions.lib}').ComponentPublicInstance]: unknown }${endOfLine}`;

	return ctx;
}

function* generateSlots(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext
): Generator<Code> {
	if (!options.hasDefineSlots) {
		yield `type __VLS_Slots = {}`;
		for (const { expVar, propsVar } of ctx.dynamicSlots) {
			yield `${newLine}& { [K in NonNullable<typeof ${expVar}>]?: (props: typeof ${propsVar}) => any }`;
		}
		for (const slot of ctx.slots) {
			yield `${newLine}& { `;
			if (slot.name && slot.offset !== undefined) {
				yield* generateObjectProperty(
					options,
					ctx,
					slot.name,
					slot.offset,
					codeFeatures.withoutHighlightAndCompletion,
					slot.nodeLoc
				);
			}
			else {
				yield* wrapWith(
					slot.tagRange[0],
					slot.tagRange[1],
					codeFeatures.withoutHighlightAndCompletion,
					`default`
				);
			}
			yield `?: (props: typeof ${slot.propsVar}) => any }`;
		}
		yield `${endOfLine}`;
	}
	return `__VLS_Slots`;
}

function* generateInheritedAttrs(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext
): Generator<Code> {
	yield `type __VLS_InheritedAttrs = {}`;
	for (const varName of ctx.inheritedAttrVars) {
		yield ` & typeof ${varName}`;
	}
	yield endOfLine;

	if (ctx.bindingAttrLocs.length) {
		yield `[`;
		for (const loc of ctx.bindingAttrLocs) {
			yield `__VLS_dollars.`;
			yield [
				loc.source,
				'template',
				loc.start.offset,
				codeFeatures.all
			];
			yield `,`;
		}
		yield `]${endOfLine}`;
	}
	return `import('${options.vueCompilerOptions.lib}').ComponentPublicInstance['$attrs'] & Partial<__VLS_InheritedAttrs>`;
}

function* generateTemplateRefs(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext
): Generator<Code> {
	yield `type __VLS_TemplateRefs = {${newLine}`;
	for (const [name, { typeExp, offset }] of ctx.templateRefs) {
		yield* generateObjectProperty(
			options,
			ctx,
			name,
			offset,
			codeFeatures.navigationAndCompletion
		);
		yield `: ${typeExp},${newLine}`;
	}
	yield `}${endOfLine}`;
	return `__VLS_TemplateRefs`;
}

function* generateRootEl(
	ctx: TemplateCodegenContext
): Generator<Code> {
	yield `type __VLS_RootEl = `;
	if (ctx.singleRootElTypes.length && !ctx.singleRootNodes.has(null)) {
		for (const type of ctx.singleRootElTypes) {
			yield `${newLine}| ${type}`;
		}
	}
	else {
		yield `any`;
	}
	yield endOfLine;
	return `__VLS_RootEl`;
}

export function forEachTemplateChild(
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode
): Generator<CompilerDOM.ElementNode>;

export function forEachTemplateChild(
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode,
	withInterpolation?: boolean
): Generator<CompilerDOM.ElementNode | CompilerDOM.InterpolationNode>;

export function forEachTemplateChild(
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode,
	withInterpolation?: boolean,
	withComment?: boolean
): Generator<CompilerDOM.ElementNode | CompilerDOM.InterpolationNode | CompilerDOM.CommentNode>;

export function* forEachTemplateChild(
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.SimpleExpressionNode,
	withInterpolation?: boolean,
	withComment?: boolean
) {
	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		for (const child of node.children) {
			yield* forEachTemplateChild(child, withInterpolation, withComment);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		const patchForNode = getVForNode(node);
		if (patchForNode) {
			yield* forEachTemplateChild(patchForNode, withInterpolation, withComment);
		}
		else {
			yield node;
			for (const child of node.children) {
				yield* forEachTemplateChild(child, withInterpolation, withComment);
			}
		}
	}
	else if (withInterpolation && node.type === CompilerDOM.NodeTypes.TEXT_CALL) {
		// {{ var }}
		yield* forEachTemplateChild(node.content, withInterpolation, withComment);
	}
	else if (withInterpolation && node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
		// {{ ... }} {{ ... }}
		for (const childNode of node.children) {
			if (typeof childNode === 'object') {
				yield* forEachTemplateChild(childNode, withInterpolation, withComment);
			}
		}
	}
	else if (withInterpolation && node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
		// {{ ... }}
		yield node;
	}
	else if (node.type === CompilerDOM.NodeTypes.IF) {
		// v-if / v-else-if / v-else
		for (let i = 0; i < node.branches.length; i++) {
			const branch = node.branches[i];
			for (const childNode of branch.children) {
				yield* forEachTemplateChild(childNode, withInterpolation, withComment);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.FOR) {
		// v-for
		for (const child of node.children) {
			yield* forEachTemplateChild(child, withInterpolation, withComment);
		}
	}
	else if (withComment && node.type === CompilerDOM.NodeTypes.COMMENT) {
		// <!-- ... -->
		yield node;
	}
}
