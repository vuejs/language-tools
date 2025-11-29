import type * as ts from 'typescript';
import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { endOfLine, newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { createTemplateCodegenContext, type TemplateCodegenContext } from './context';
import { generateObjectProperty } from './objectProperty';
import { generateStyleScopedClassReferences } from './styleScopedClasses';
import { generateTemplateChild } from './templateChild';

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
	propsAssignName?: string;
	slotsAssignName?: string;
	inheritAttrs: boolean;
	selfComponentName?: string;
}

export { generate as generateTemplate };

function generate(options: TemplateCodegenOptions) {
	const context = createTemplateCodegenContext(options);
	const codegen = generateTemplate(options, context);
	const codes: Code[] = [];

	for (const code of codegen) {
		if (typeof code === 'object') {
			code[3] = context.resolveCodeFeatures(code[3]);
		}
		codes.push(code);
	}

	return {
		...context,
		codes,
	};
}

function* generateTemplate(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	const endScope = ctx.startScope();

	if (options.slotsAssignName) {
		ctx.declare(options.slotsAssignName);
	}
	if (options.propsAssignName) {
		ctx.declare(options.propsAssignName);
	}
	if (options.vueCompilerOptions.inferTemplateDollarSlots) {
		ctx.dollarVars.add('$slots');
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
		yield* generateTemplateChild(options, ctx, options.template.ast);
	}
	yield* generateStyleScopedClassReferences(ctx);
	yield* ctx.generateHoistVariables();

	const dollarSlotsType = yield* generateSlots(options, ctx);
	const dollarAttrsType = yield* generateInheritedAttrs(options, ctx);
	const dollarRefsType = yield* generateTemplateRefs(options, ctx);
	const dollarElType = yield* generateRootEl(ctx);

	if (ctx.dollarVars.size) {
		yield `var __VLS_dollars!: {${newLine}`;
		if (ctx.dollarVars.has('$slots')) {
			yield `$slots: ${dollarSlotsType}${endOfLine}`;
		}
		if (ctx.dollarVars.has('$attrs')) {
			yield `$attrs: ${dollarAttrsType}${endOfLine}`;
		}
		if (ctx.dollarVars.has('$refs')) {
			yield `$refs: ${dollarRefsType}${endOfLine}`;
		}
		if (ctx.dollarVars.has('$el')) {
			yield `$el: ${dollarElType}${endOfLine}`;
		}
		yield `} & { [K in keyof import('${options.vueCompilerOptions.lib}').ComponentPublicInstance]: unknown }${endOfLine}`;
	}

	yield* endScope();
}

function* generateSlots(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code, string> {
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
					codeFeatures.navigation,
				);
			}
			else {
				const token = yield* startBoundary('template', slot.tagRange[0], codeFeatures.navigation);
				yield `default`;
				yield endBoundary(token, slot.tagRange[1]);
			}
			yield `?: (props: typeof ${slot.propsVar}) => any }`;
		}
		yield endOfLine;
	}
	return `__VLS_Slots`;
}

function* generateInheritedAttrs(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code, string> {
	yield `type __VLS_InheritedAttrs = ${
		ctx.inheritedAttrVars.size
			? `Partial<${[...ctx.inheritedAttrVars].map(name => `typeof ${name}`).join(` & `)}>`
			: `{}`
	}`;
	yield endOfLine;
	if (ctx.bindingAttrLocs.length) {
		yield `[`;
		for (const loc of ctx.bindingAttrLocs) {
			yield `__VLS_dollars.`;
			yield [
				loc.source,
				'template',
				loc.start.offset,
				codeFeatures.all,
			];
			yield `,`;
		}
		yield `]${endOfLine}`;
	}
	return `import('${options.vueCompilerOptions.lib}').ComponentPublicInstance['$attrs'] & __VLS_InheritedAttrs`;
}

function* generateTemplateRefs(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code, string> {
	yield `type __VLS_TemplateRefs = {}`;
	for (const [name, refs] of ctx.templateRefs) {
		yield `${newLine}& `;
		if (refs.length >= 2) {
			yield `(`;
		}
		for (let i = 0; i < refs.length; i++) {
			const { typeExp, offset } = refs[i]!;
			if (i) {
				yield ` | `;
			}
			yield `{ `;
			yield* generateObjectProperty(
				options,
				ctx,
				name,
				offset,
				codeFeatures.navigation,
			);
			yield `: ${typeExp} }`;
		}
		if (refs.length >= 2) {
			yield `)`;
		}
	}
	yield endOfLine;
	return `__VLS_TemplateRefs`;
}

function* generateRootEl(
	ctx: TemplateCodegenContext,
): Generator<Code, string> {
	yield `type __VLS_RootEl = `;
	if (ctx.singleRootElTypes.size && !ctx.singleRootNodes.has(null)) {
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
