import {
	type IRTemplate,
	type TemplateScope,
	type TypeScript,
	type VueCodeMarker,
	type VueCompilerOptions,
} from '@vue/language-core';
import type { TsCode } from '../tsCode';
import { createTemplateCodegenContext, type TemplateCodegenContext } from './context';
import type { ElementSlots } from './element';
import { generateObjectProperty } from './objectProperty';
import { generateTemplateChild } from './templateChild';

/** A key at `offset` of the template, which the template generates as an object property in its own scope. */
export interface TemplateKey {
	key: string;
	offset: number;
	features: VueCodeMarker;
}

export type TemplateCode = TsCode | TemplateKey;

/** What the traversal of the template collects, as plain data. */
export interface TemplateFacts {
	/** The refs of the elements, by name: the type of each element and the offset of its name. */
	templateRefs: ReadonlyMap<string, readonly { typeExp: string; offset: number }[]>;
	/** The types of the root elements of a template with a single root in each branch. */
	singleRootElTypes: ReadonlySet<string>;
	/** Whether a root of the template is not an element, so that it has no single root element. */
	hasNonElementRoot: boolean;
	/** The variables whose types the attributes that fall through to the root take. */
	inheritedAttrVars: ReadonlySet<string>;
	/** The slots of the template with a static name, and the variable of their props. */
	slots: readonly { name: string; offset?: number; tagRange: [number, number]; propsVar: string }[];
	/** The slots of the template with a dynamic name: the variables of their name and props. */
	dynamicSlots: readonly { expVar: string; propsVar: string }[];
	/** The `$` names that the template reads, e.g. `$attrs`. */
	dollarVars: ReadonlySet<string>;
	/** The names of the types that the template function declares so far. */
	types: ReadonlySet<string>;
}

/** Code at the end of the template, and the names of the types that it declares. */
export interface TemplateEnd {
	types?: readonly string[];
	codes: readonly TemplateCode[];
}

/** The hooks of the template. */
export interface TemplateHooks {
	/** Code at the end of the template, in its scope, from what its traversal collected. Hooks run in concern order. */
	generateTemplateEnd?(facts: TemplateFacts): TemplateEnd | undefined;
}

export interface TemplateCodegenOptions {
	typescript: TypeScript;
	vueCompilerOptions: VueCompilerOptions;
	template: IRTemplate;
	isVapor: boolean;
	scriptLang: string;
	setupRefs: Set<string>;
	setupConsts: Set<string>;
	setupBindings: Set<string>;
	// The setup bindings that a template directive refers to by its name, like `vFoo` for `v-foo`.
	localDirectives: Set<string>;
	// The keys of the `directives` option that template directives resolve to, by the name the template refers to them by.
	optionDirectives: Map<string, string>;
	// Bindings narrowed at least once anywhere in the template/styles; every
	// access of these is emitted with `.value`.
	dotValueBindings: Set<string>;
	// The subset of `dotValueBindings` re-asserted at closure tops (imports, `let`/`var`).
	reassertBindings: Set<string>;
	hasDefineSlots?: boolean;
	propsAssignName?: string;
	slotsAssignName?: string;
	inheritAttrs: boolean;
	componentName: string;
	templateScope: TemplateScope;
	slots: ElementSlots;
	generateTemplateEnd: readonly NonNullable<TemplateHooks['generateTemplateEnd']>[];
}

export { generate as generateTemplate };

function generate(options: TemplateCodegenOptions) {
	const ctx = createTemplateCodegenContext(options.scriptLang, options.templateScope, options.template);
	const codeGenerator = generateWorker(options, ctx);
	const codes: TsCode[] = [];
	for (const code of codeGenerator) {
		codes.push(...ctx.generateWithDiagnosticDirectiveRanges(code));
	}
	codes.push(...ctx.generateDiagnosticDirectiveRangesEnd());
	return { ...ctx, codes, facts: getFacts(ctx) };
}

function getFacts(ctx: TemplateCodegenContext): TemplateFacts {
	return {
		templateRefs: ctx.templateRefs,
		singleRootElTypes: ctx.singleRootElTypes,
		hasNonElementRoot: ctx.singleRootNodes.has(null),
		inheritedAttrVars: ctx.inheritedAttrVars,
		slots: ctx.slots,
		dynamicSlots: ctx.dynamicSlots,
		dollarVars: ctx.dollarVars,
		types: ctx.generatedTypes,
	};
}

function isTemplateKey(code: TemplateCode): code is TemplateKey {
	return typeof code === 'object' && 'key' in code;
}

function* generateWorker(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<TsCode> {
	const { vueCompilerOptions, template } = options;

	ctx.enterBlockScope(template);
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
	yield* ctx.generateHoistVariables(options.scriptLang);

	const facts = getFacts(ctx);
	for (const generateTemplateEnd of options.generateTemplateEnd) {
		const end = generateTemplateEnd(facts);
		for (const type of end?.types ?? []) {
			ctx.generatedTypes.add(type);
		}
		for (const code of end?.codes ?? []) {
			if (isTemplateKey(code)) {
				yield* generateObjectProperty(options, ctx, code.key, code.offset, code.features);
			}
			else {
				yield code;
			}
		}
	}

	yield* ctx.exitBlockScope();
}
