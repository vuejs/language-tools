import type * as ts from 'typescript';
import type { Code, IRTemplate, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { endOfLine, generateTypeAlias, generateTypedVar, newLine } from '../utils';
import { Boundary } from '../utils/boundary';
import { createTemplateCodegenContext, type TemplateCodegenContext } from './context';
import { generateObjectProperty } from './objectProperty';
import { references as styleScopedClassReferences } from './styleScopedClasses';
import { generateTemplateChild } from './templateChild';

export interface TemplateCodegenOptions {
	typescript: typeof ts;
	vueCompilerOptions: VueCompilerOptions;
	template: IRTemplate;
	isVapor: boolean;
	scriptLang: string;
	destructuredProps: Set<string>;
	importedComponents: Set<string>;
	setupRefs: Set<string>;
	setupBindings: Set<string>;
	// Bindings narrowed at least once anywhere in the template/styles; every
	// access of these is emitted with `.value`. Collected by a first codegen pass.
	dotValueBindings: Set<string>;
	// The subset of `dotValueBindings` re-asserted at closure tops (imports, `let`/`var`).
	reassertBindings: Set<string>;
	hasDefineSlots?: boolean;
	propsAssignName?: string;
	slotsAssignName?: string;
	inheritAttrs: boolean;
	componentName: string;
}

export { generate as generateTemplate };

function generate(options: TemplateCodegenOptions) {
	// The references registry accumulates across codegen passes; start clean.
	styleScopedClassReferences.delete(options.template);
	const ctx = createTemplateCodegenContext();
	const codeGenerator = generateWorker(options, ctx);
	const codes: Code[] = [];
	for (const code of codeGenerator) {
		if (typeof code === 'object') {
			code[3] = ctx.resolveCodeFeatures(code[3]);
		}
		codes.push(code);
	}
	return { ...ctx, codes };
}

function* generateWorker(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	const scope = ctx.scope();
	const {
		slotsAssignName,
		propsAssignName,
		vueCompilerOptions,
		template,
	} = options;

	if (slotsAssignName) {
		scope.declare(slotsAssignName);
	}
	if (propsAssignName) {
		scope.declare(propsAssignName);
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
	yield* ctx.generateHoistVariables();
	yield* generateSlotsType(options, ctx);
	yield* generateInheritedAttrsType(options, ctx);
	yield* generateTemplateRefsType(options, ctx);
	yield* generateRootElType(options, ctx);

	if (ctx.dollarVars.size) {
		yield* generateTypedVar('var', names.dollars, options.scriptLang, function*() {
			yield `{${newLine}`;
			if (ctx.dollarVars.has('$slots')) {
				const type = ctx.generatedTypes.has(names.Slots) ? names.Slots : `{}`;
				yield `$slots: ${type}${endOfLine}`;
			}
			if (ctx.dollarVars.has('$attrs')) {
				yield `$attrs: import('${vueCompilerOptions.lib}').ComponentPublicInstance['$attrs']`;
				if (ctx.generatedTypes.has(names.InheritedAttrs)) {
					yield ` & ${names.InheritedAttrs}`;
				}
				yield endOfLine;
			}
			if (ctx.dollarVars.has('$refs')) {
				const type = ctx.generatedTypes.has(names.TemplateRefs) ? names.TemplateRefs : `{}`;
				yield `$refs: ${type}${endOfLine}`;
			}
			if (ctx.dollarVars.has('$el')) {
				const type = ctx.generatedTypes.has(names.RootEl) ? names.RootEl : `any`;
				yield `$el: ${type}${endOfLine}`;
			}
			yield `} & { [K in keyof import('${vueCompilerOptions.lib}').ComponentPublicInstance]: unknown }`;
		});
	}

	yield* scope.end();
}

function* generateSlotsType(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	if (options.hasDefineSlots) {
		ctx.generatedTypes.add(names.Slots);
		return;
	}
	if (!ctx.slots.length && !ctx.dynamicSlots.length) {
		return;
	}
	ctx.generatedTypes.add(names.Slots);

	yield* generateTypeAlias(names.Slots, options.scriptLang, function*() {
		yield `{}`;
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
				const boundary = yield* Boundary.start('template', ...slot.tagRange, codeFeatures.navigation);
				yield `default`;
				yield boundary.end();
			}
			yield `?: (props: typeof ${slot.propsVar}) => any }`;
		}
	});
}

function* generateInheritedAttrsType(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	if (!ctx.inheritedAttrVars.size) {
		return;
	}
	ctx.generatedTypes.add(names.InheritedAttrs);

	const type = [...ctx.inheritedAttrVars].map(name => `typeof ${name}`).join(` & `);

	yield* generateTypeAlias(names.InheritedAttrs, options.scriptLang, function*() {
		yield options.vueCompilerOptions.checkRequiredFallthroughAttributes
			? type
			: `Partial<${type}>`;
	});
}

function* generateTemplateRefsType(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	if (
		!ctx.templateRefs.size
		|| !(
			options.vueCompilerOptions.inferTemplateDollarRefs
			|| options.vueCompilerOptions.inferComponentDollarRefs
			|| options.setupRefs.size
		)
	) {
		return;
	}
	ctx.generatedTypes.add(names.TemplateRefs);

	yield* generateTypeAlias(names.TemplateRefs, options.scriptLang, function*() {
		yield `{}`;
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
	});
}

function* generateRootElType(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	if (!ctx.singleRootElTypes.size || ctx.singleRootNodes.has(null)) {
		return;
	}
	ctx.generatedTypes.add(names.RootEl);

	yield* generateTypeAlias(names.RootEl, options.scriptLang, function*() {
		for (const type of ctx.singleRootElTypes) {
			yield `${newLine}| ${type}`;
		}
	});
}
