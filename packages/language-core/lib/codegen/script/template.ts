import { camelize, capitalize } from '@vue/shared';
import * as path from 'path-browserify';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { generateStyleModules } from '../style/modules';
import { generateStyleScopedClasses } from '../style/scopedClasses';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import { generateStyleScopedClassReferences } from '../template/styleScopedClasses';
import { createSfcBlockGenerator, endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { generateSpreadMerge } from '../utils/merge';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';

export function* generateTemplate(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	ctx.generatedTemplate = true;

	yield* generateSelf(options);
	yield* generateTemplateCtx(options, ctx);
	yield* generateTemplateComponents(options);
	yield* generateTemplateDirectives(options);
	yield* generateTemplateBody(options, ctx);
}

function* generateSelf(options: ScriptCodegenOptions): Generator<Code> {
	if (options.sfc.script && options.scriptRanges?.componentOptions) {
		const { args, expose } = options.scriptRanges.componentOptions;
		const { replace, generate } = createSfcBlockGenerator(
			options.sfc.script,
			args.start,
			args.end,
			codeFeatures.navigation,
		);

		if (expose) {
			replace(expose.start, expose.end, `undefined`);
		}

		yield `const __VLS_self = (await import('${options.vueCompilerOptions.lib}')).defineComponent(`;
		yield* generate();
		yield `)${endOfLine}`;
	}
	else if (options.sfc.script && options.scriptRanges?.exportDefault) {
		yield `const __VLS_self = `;
		const { expression } = options.scriptRanges.exportDefault;
		yield generateSfcBlockSection(options.sfc.script, expression.start, expression.end, codeFeatures.all);
		yield endOfLine;
	}
	else if (options.sfc.script?.src) {
		yield `let __VLS_self!: typeof import('./${path.basename(options.fileName)}').default${endOfLine}`;
	}
}

function* generateTemplateCtx(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	const exps: Code[] = [];

	if (options.vueCompilerOptions.petiteVueExtensions.some(ext => options.fileName.endsWith(ext))) {
		exps.push(`globalThis`);
	}
	if (options.sfc.script?.src || options.scriptRanges?.exportDefault) {
		exps.push(`{} as InstanceType<__VLS_PickNotAny<typeof __VLS_self, new () => {}>>`);
	}
	else {
		exps.push(`{} as import('${options.vueCompilerOptions.lib}').ComponentPublicInstance`);
	}
	if (options.sfc.styles.some(style => style.module)) {
		exps.push(`{} as __VLS_StyleModules`);
	}

	const emitTypes: string[] = [];
	if (options.scriptSetupRanges?.defineEmits) {
		const { defineEmits } = options.scriptSetupRanges;
		emitTypes.push(`typeof ${defineEmits.name ?? `__VLS_emit`}`);
	}
	if (options.scriptSetupRanges?.defineModel.length) {
		emitTypes.push(`typeof __VLS_modelEmit`);
	}
	if (emitTypes.length) {
		yield `type __VLS_EmitProps = __VLS_EmitsToProps<__VLS_NormalizeEmits<${emitTypes.join(` & `)}>>${endOfLine}`;
		exps.push(`{} as { $emit: ${emitTypes.join(` & `)} }`);
	}

	const propTypes: string[] = [];
	const { defineProps, withDefaults } = options.scriptSetupRanges ?? {};
	const props = defineProps?.arg
		? `typeof ${defineProps.name ?? `__VLS_props`}`
		: defineProps?.typeArg
		? withDefaults?.arg
			? `__VLS_WithDefaultsGlobal<__VLS_Props, typeof __VLS_defaults>`
			: `__VLS_Props`
		: undefined;
	if (props) {
		propTypes.push(props);
	}
	if (options.scriptSetupRanges?.defineModel.length) {
		propTypes.push(`__VLS_ModelProps`);
	}
	if (emitTypes.length) {
		propTypes.push(`__VLS_EmitProps`);
	}
	if (propTypes.length) {
		yield `type __VLS_InternalProps = ${propTypes.join(` & `)}${endOfLine}`;
		exps.push(`{} as { $props: __VLS_InternalProps }`);
		exps.push(`{} as __VLS_InternalProps`);
	}

	if (options.scriptSetupRanges && ctx.bindingNames.size) {
		exps.push(`{} as __VLS_Bindings`);
	}

	yield `const __VLS_ctx = `;
	yield* generateSpreadMerge(exps);
	yield endOfLine;
}

function* generateTemplateComponents(options: ScriptCodegenOptions): Generator<Code> {
	const types: string[] = [`typeof __VLS_ctx`];

	if (options.sfc.script && options.scriptRanges?.componentOptions?.components) {
		const { components } = options.scriptRanges.componentOptions;
		yield `const __VLS_componentsOption = `;
		yield generateSfcBlockSection(
			options.sfc.script,
			components.start,
			components.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`typeof __VLS_componentsOption`);
	}

	yield `type __VLS_LocalComponents = ${types.join(` & `)}${endOfLine}`;
	yield `let __VLS_components!: __VLS_LocalComponents & __VLS_GlobalComponents${endOfLine}`;
}

function* generateTemplateDirectives(options: ScriptCodegenOptions): Generator<Code> {
	const types: string[] = [`typeof __VLS_ctx`];

	if (options.sfc.script && options.scriptRanges?.componentOptions?.directives) {
		const { directives } = options.scriptRanges.componentOptions;
		yield `const __VLS_directivesOption = `;
		yield generateSfcBlockSection(
			options.sfc.script,
			directives.start,
			directives.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`__VLS_ResolveDirectives<typeof __VLS_directivesOption>`);
	}

	yield `type __VLS_LocalDirectives = ${types.join(` & `)}${endOfLine}`;
	yield `let __VLS_directives!: __VLS_LocalDirectives & __VLS_GlobalDirectives${endOfLine}`;
}

function* generateTemplateBody(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	const templateCodegenCtx = createTemplateCodegenContext({
		scriptSetupBindingNames: new Set(),
	});

	yield* generateStyleScopedClasses(options, templateCodegenCtx);
	yield* generateStyleScopedClassReferences(templateCodegenCtx, true);
	yield* generateStyleModules(options);
	yield* generateCssVars(options, templateCodegenCtx);
	yield* generateBindings(options, ctx, templateCodegenCtx);

	if (options.templateCodegen) {
		yield* options.templateCodegen.codes;
	}
	else {
		if (!options.scriptSetupRanges?.defineSlots) {
			yield `type __VLS_Slots = {}${endOfLine}`;
		}
		yield `type __VLS_InheritedAttrs = {}${endOfLine}`;
		yield `type __VLS_TemplateRefs = {}${endOfLine}`;
		yield `type __VLS_RootEl = any${endOfLine}`;
	}
}

function* generateCssVars(
	options: ScriptCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	for (const style of options.sfc.styles) {
		for (const binding of style.bindings) {
			yield* generateInterpolation(
				options,
				ctx,
				style.name,
				codeFeatures.all,
				binding.text,
				binding.offset,
				`(`,
				`)`,
			);
			yield endOfLine;
		}
	}
}

function* generateBindings(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	templateCodegenCtx: TemplateCodegenContext,
): Generator<Code> {
	if (!options.sfc.scriptSetup || !ctx.bindingNames.size) {
		return;
	}

	const usageVars = new Set([
		...options.sfc.template?.ast?.components.flatMap(c => [camelize(c), capitalize(camelize(c))]) ?? [],
		...options.templateCodegen?.accessExternalVariables.keys() ?? [],
		...templateCodegenCtx.accessExternalVariables.keys(),
	]);

	yield `type __VLS_Bindings = __VLS_ProxyRefs<{${newLine}`;
	for (const varName of ctx.bindingNames) {
		if (!usageVars.has(varName)) {
			continue;
		}

		const token = Symbol(varName.length);
		yield ['', undefined, 0, { __linkedToken: token }];
		yield `${varName}: typeof `;
		yield ['', undefined, 0, { __linkedToken: token }];
		yield varName;
		yield endOfLine;
	}
	yield `}>${endOfLine}`;
}
