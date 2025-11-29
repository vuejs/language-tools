import type * as ts from 'typescript';
import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import * as names from '../names';
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
	const codegen = generateWorker(options, context);
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

function* generateWorker(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	const endScope = ctx.startScope();
	const {
		slotsAssignName,
		propsAssignName,
		vueCompilerOptions,
		template,
		hasDefineSlots,
	} = options;

	if (slotsAssignName) {
		ctx.declare(slotsAssignName);
	}
	if (propsAssignName) {
		ctx.declare(propsAssignName);
	}
	if (vueCompilerOptions.inferTemplateDollarSlots) {
		ctx.dollarVars.add('$slots');
	}
	if (vueCompilerOptions.inferTemplateDollarAttrs) {
		ctx.dollarVars.add('$attrs');
	}
	if (vueCompilerOptions.inferTemplateDollarRefs) {
		ctx.dollarVars.add('$refs');
	}
	if (vueCompilerOptions.inferTemplateDollarEl) {
		ctx.dollarVars.add('$el');
	}
	if (template.ast) {
		yield* generateTemplateChild(options, ctx, template.ast);
	}
	yield* generateStyleScopedClassReferences(ctx);
	yield* ctx.generateHoistVariables();

	if (!hasDefineSlots) {
		yield* generateSlotsType(options, ctx);
	}
	yield* generateInheritedAttrsType(ctx);
	yield* generateTemplateRefsType(options, ctx);
	yield* generateRootElType(ctx);

	if (ctx.dollarVars.size) {
		yield `var ${names.dollars}!: {${newLine}`;
		if (ctx.dollarVars.has('$slots')) {
			yield `$slots: ${names.Slots}${endOfLine}`;
		}
		if (ctx.dollarVars.has('$attrs')) {
			yield `$attrs: import('${vueCompilerOptions.lib}').ComponentPublicInstance['$attrs'] & ${names.InheritedAttrs}${endOfLine}`;
		}
		if (ctx.dollarVars.has('$refs')) {
			yield `$refs: ${names.TemplateRefs}${endOfLine}`;
		}
		if (ctx.dollarVars.has('$el')) {
			yield `$el: ${names.RootEl}${endOfLine}`;
		}
		yield `} & { [K in keyof import('${vueCompilerOptions.lib}').ComponentPublicInstance]: unknown }${endOfLine}`;
	}

	yield* endScope();
}

function* generateSlotsType(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	yield `type ${names.Slots} = {}`;
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

function* generateInheritedAttrsType(ctx: TemplateCodegenContext): Generator<Code> {
	yield `type ${names.InheritedAttrs} = ${
		ctx.inheritedAttrVars.size
			? `Partial<${[...ctx.inheritedAttrVars].map(name => `typeof ${name}`).join(` & `)}>`
			: `{}`
	}`;
	yield endOfLine;
}

function* generateTemplateRefsType(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	yield `type ${names.TemplateRefs} = {}`;
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
}

function* generateRootElType(ctx: TemplateCodegenContext): Generator<Code> {
	yield `type ${names.RootEl} = `;
	if (ctx.singleRootElTypes.size && !ctx.singleRootNodes.has(null)) {
		for (const type of ctx.singleRootElTypes) {
			yield `${newLine}| ${type}`;
		}
	}
	else {
		yield `any`;
	}
	yield endOfLine;
}
