import type * as ts from 'typescript';
import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { endOfLine, newLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';
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
	const context = createTemplateCodegenContext(options, options.template.ast);
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
	if (options.slotsAssignName) {
		ctx.addLocalVariable(options.slotsAssignName);
	}
	if (options.propsAssignName) {
		ctx.addLocalVariable(options.propsAssignName);
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

	const dollarTypes = [
		['$slots', yield* generateSlots(options, ctx)],
		['$attrs', yield* generateInheritedAttrs(options, ctx)],
		['$refs', yield* generateTemplateRefs(options, ctx)],
		['$el', yield* generateRootEl(ctx)],
	].filter(([name]) => ctx.dollarVars.has(name!));

	if (dollarTypes.length) {
		yield `var __VLS_dollars!: {${newLine}`;
		for (const [name, type] of dollarTypes) {
			yield `${name}: ${type}${endOfLine}`;
		}
		yield `} & { [K in keyof import('${options.vueCompilerOptions.lib}').ComponentPublicInstance]: unknown }${endOfLine}`;
	}
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
				yield* wrapWith(
					slot.tagRange[0],
					slot.tagRange[1],
					codeFeatures.navigation,
					`default`,
				);
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
