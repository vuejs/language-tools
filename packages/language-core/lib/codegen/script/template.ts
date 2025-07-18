import type { Code } from '../../types';
import { hyphenateTag } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { generateStyleModules } from '../style/modules';
import { generateStyleScopedClasses } from '../style/scopedClasses';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import { generateStyleScopedClassReferences } from '../template/styleScopedClasses';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { generateIntersectMerge, generateSpreadMerge } from '../utils/merge';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';

export function* generateTemplate(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	ctx.generatedTemplate = true;

	const templateCodegenCtx = createTemplateCodegenContext({
		scriptSetupBindingNames: new Set(),
	});
	yield* generateTemplateCtx(options, ctx);
	yield* generateTemplateElements();
	yield* generateTemplateComponents(options);
	yield* generateTemplateDirectives(options);
	yield* generateTemplateBody(options, templateCodegenCtx);
	yield* generateBindings(options, ctx, templateCodegenCtx);

	if (options.sfc.script && options.scriptRanges?.exportDefault) {
		yield `const __VLS_self = (await import('${options.vueCompilerOptions.lib}')).defineComponent(`;
		const { args } = options.scriptRanges.exportDefault;
		yield generateSfcBlockSection(options.sfc.script, args.start, args.end, codeFeatures.all);
		yield `)${endOfLine}`;
	}
}

function* generateTemplateCtx(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	const exps: Code[] = [];

	if (options.sfc.script && options.scriptRanges?.exportDefault) {
		exps.push(`{} as InstanceType<__VLS_PickNotAny<typeof __VLS_self, new () => {}>>`);
	}
	else {
		exps.push(`{} as import('${options.vueCompilerOptions.lib}').ComponentPublicInstance`);
	}

	if (options.vueCompilerOptions.petiteVueExtensions.some(ext => options.fileName.endsWith(ext))) {
		exps.push(`globalThis`);
	}
	if (options.sfc.styles.some(style => style.module)) {
		exps.push(`{} as __VLS_StyleModules`);
	}

	if (ctx.generatedPropsType || options.scriptSetupRanges?.defineProps) {
		yield `type __VLS_InternalProps = `;
		const { defineProps } = options.scriptSetupRanges ?? {};
		if (defineProps) {
			yield `__VLS_SpreadMerge<__VLS_PublicProps, typeof ${defineProps.name ?? `__VLS_props`}>`;
		}
		else {
			yield `__VLS_PublicProps`;
		}
		yield endOfLine;
		exps.push(`{} as __VLS_InternalProps`);
		exps.push(`{} as { $props: __VLS_InternalProps }`);
	}

	const emitTypes: Code[] = [];
	if (options.scriptSetupRanges?.defineEmits) {
		emitTypes.push(`typeof ${options.scriptSetupRanges.defineEmits.name ?? `__VLS_emit`}`);
	}
	if (options.scriptSetupRanges?.defineModel.length) {
		emitTypes.push(`typeof __VLS_modelEmit`);
	}
	if (emitTypes.length) {
		exps.push(`{} as { $emit: ${emitTypes.join(' & ')} }`);
	}

	exps.push(`{} as __VLS_Bindings`);

	yield `const __VLS_ctx = `;
	yield* generateSpreadMerge(exps);
	yield endOfLine;
}

function* generateTemplateElements(): Generator<Code> {
	yield `let __VLS_elements!: __VLS_IntrinsicElements${endOfLine}`;
}

function* generateTemplateComponents(options: ScriptCodegenOptions): Generator<Code> {
	const types: Code[] = [`typeof __VLS_ctx`];

	if (options.sfc.script && options.scriptRanges?.exportDefault?.componentsOption) {
		const { componentsOption } = options.scriptRanges.exportDefault;
		yield `const __VLS_componentsOption = `;
		yield [
			options.sfc.script.content.slice(componentsOption.start, componentsOption.end),
			'script',
			componentsOption.start,
			codeFeatures.navigation,
		];
		yield endOfLine;
		types.push(`typeof __VLS_componentsOption`);
	}

	yield `type __VLS_LocalComponents = `;
	yield* generateIntersectMerge(types);
	yield endOfLine;

	yield `let __VLS_components!: __VLS_LocalComponents & __VLS_GlobalComponents${endOfLine}`;
}

function* generateTemplateDirectives(options: ScriptCodegenOptions): Generator<Code> {
	const types: Code[] = [`typeof __VLS_ctx`];

	if (options.sfc.script && options.scriptRanges?.exportDefault?.directivesOption) {
		const { directivesOption } = options.scriptRanges.exportDefault;
		yield `const __VLS_directivesOption = `;
		yield [
			options.sfc.script.content.slice(directivesOption.start, directivesOption.end),
			'script',
			directivesOption.start,
			codeFeatures.navigation,
		];
		yield endOfLine;
		types.push(`__VLS_ResolveDirectives<typeof __VLS_directivesOption>`);
	}

	yield `type __VLS_LocalDirectives = `;
	yield* generateIntersectMerge(types);
	yield endOfLine;

	yield `let __VLS_directives!: __VLS_LocalDirectives & __VLS_GlobalDirectives${endOfLine}`;
}

function* generateTemplateBody(
	options: ScriptCodegenOptions,
	templateCodegenCtx: TemplateCodegenContext,
): Generator<Code> {
	yield* generateStyleScopedClasses(options, templateCodegenCtx);
	yield* generateStyleScopedClassReferences(templateCodegenCtx, true);
	yield* generateStyleModules(options);
	yield* generateCssVars(options, templateCodegenCtx);

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

function* generateCssVars(options: ScriptCodegenOptions, ctx: TemplateCodegenContext): Generator<Code> {
	if (!options.sfc.styles.length) {
		return;
	}
	yield `// CSS variable injection ${newLine}`;
	for (const style of options.sfc.styles) {
		for (const cssBind of style.cssVars) {
			yield* generateInterpolation(
				options,
				ctx,
				style.name,
				codeFeatures.all,
				cssBind.text,
				cssBind.offset,
			);
			yield endOfLine;
		}
	}
	yield `// CSS variable injection end ${newLine}`;
}

function* generateBindings(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	templateCodegenCtx: TemplateCodegenContext,
): Generator<Code> {
	yield `type __VLS_Bindings = __VLS_ProxyRefs<{${newLine}`;
	if (options.sfc.scriptSetup && options.scriptSetupRanges) {
		const templateUsageVars = getTemplateUsageVars(options, ctx);
		for (
			const [content, bindings] of [
				[options.sfc.scriptSetup.content, options.scriptSetupRanges.bindings] as const,
				options.sfc.script && options.scriptRanges
					? [options.sfc.script.content, options.scriptRanges.bindings] as const
					: ['', []] as const,
			]
		) {
			for (const { range } of bindings) {
				const varName = content.slice(range.start, range.end);
				if (!templateUsageVars.has(varName) && !templateCodegenCtx.accessExternalVariables.has(varName)) {
					continue;
				}

				const token = Symbol(varName.length);
				yield ['', undefined, 0, { __linkedToken: token }];
				yield `${varName}: typeof `;
				yield ['', undefined, 0, { __linkedToken: token }];
				yield `${varName},${newLine}`;
			}
		}
	}
	yield `}>${endOfLine}`;
}

function getTemplateUsageVars(options: ScriptCodegenOptions, ctx: ScriptCodegenContext) {
	const usageVars = new Set<string>();
	const components = new Set(options.sfc.template?.ast?.components);

	if (options.templateCodegen) {
		// fix import components unused report
		for (const varName of ctx.bindingNames) {
			if (components.has(varName) || components.has(hyphenateTag(varName))) {
				usageVars.add(varName);
			}
		}
		for (const component of components) {
			if (component.includes('.')) {
				usageVars.add(component.split('.')[0]);
			}
		}
		for (const [varName] of options.templateCodegen.accessExternalVariables) {
			usageVars.add(varName);
		}
	}

	return usageVars;
}
