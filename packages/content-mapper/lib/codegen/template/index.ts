import type * as CompilerDOM from '@vue/compiler-dom';
import type { IRTemplate, TemplateScope, TypeScript, VueCompilerOptions } from '@vue/language-core';
import type { TsCode } from '../tsCode';
import { createTemplateCodegenContext, type TemplateCodegenContext } from './context';
import type { ElementSlots } from './element';
import { generateTemplateChild } from './templateChild';

/** The variables that the code of the template declares for its nodes, as the code at its end reads them. */
export interface TemplateVars {
	/** The instances of the components with a ref or a single root, and the hoisted one of a component with a ref. */
	componentInstanceVars: ReadonlyMap<CompilerDOM.ElementNode, { instanceVar: string; hoistedVar?: string }>;
	/** The props of the slot outlets without `defineSlots`, and the name of one with a dynamic name, hoisted. */
	slotVars: ReadonlyMap<CompilerDOM.ElementNode, { propsVar: string; expVar?: string }>;
	/** The variables whose types the attributes that fall through to the root take. */
	inheritedAttrVars: ReadonlySet<string>;
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
	hasDefineSlots?: boolean;
	propsAssignName?: string;
	slotsAssignName?: string;
	inheritAttrs: boolean;
	componentName: string;
	templateScope: TemplateScope;
	slots: ElementSlots;
}

export { generate as generateTemplate };

/**
 * The code of the template, in the scope of the template, and the code that ends the scope: the code at the end of
 * the template goes between them.
 */
function generate(options: TemplateCodegenOptions) {
	const ctx = createTemplateCodegenContext(options.scriptLang, options.templateScope, options.template);
	const codes: TsCode[] = [];
	for (const code of generateWorker(options, ctx)) {
		codes.push(...ctx.generateWithDiagnosticDirectiveRanges(code));
	}
	codes.push(...ctx.generateDiagnosticDirectiveRangesEnd());
	const scopeEnd = [...ctx.exitBlockScope()];
	const vars: TemplateVars = {
		componentInstanceVars: ctx.componentInstanceVars,
		slotVars: ctx.slotVars,
		inheritedAttrVars: ctx.inheritedAttrVars,
	};
	return {
		codes,
		scopeEnd,
		bindingReferences: ctx.bindingReferences,
		generatedTypes: ctx.generatedTypes as ReadonlySet<string>,
		vars,
	};
}

function* generateWorker(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<TsCode> {
	const { template } = options;
	ctx.enterBlockScope(template);
	if (template.ast) {
		yield* generateTemplateChild(options, ctx, template.ast);
	}
	yield* ctx.generateHoistVariables(options.scriptLang);
}
