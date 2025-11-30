import { camelize, capitalize } from '@vue/shared';
import * as path from 'path-browserify';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import * as names from '../names';
import { generateStyleModules } from '../style/modules';
import { generateStyleScopedClasses } from '../style/scopedClasses';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { generateSpreadMerge } from '../utils/merge';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';

export function* generateTemplate(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	yield* generateSelf(options);
	yield* generateTemplateCtx(options, ctx);
	yield* generateTemplateComponents(options);
	yield* generateTemplateDirectives(options);

	const templateCodegenCtx = createTemplateCodegenContext({
		scriptSetupBindingNames: new Set(),
	});

	yield* generateStyleScopedClasses(options);
	yield* generateStyleModules(options);
	yield* generateCssVars(options, templateCodegenCtx);
	yield* generateBindings(options, ctx, templateCodegenCtx);

	if (options.templateCodegen) {
		yield* options.templateCodegen.codes;
	}
}

function* generateSelf({ script, scriptRanges, vueCompilerOptions, fileName }: ScriptCodegenOptions): Generator<Code> {
	if (script && scriptRanges?.componentOptions) {
		yield `const ${names.self} = (await import('${vueCompilerOptions.lib}')).defineComponent(`;
		const { args } = scriptRanges.componentOptions;
		yield* generateSfcBlockSection(script, args.start, args.end, codeFeatures.all);
		yield `)${endOfLine}`;
	}
	else if (script && scriptRanges?.exportDefault) {
		yield `const ${names.self} = `;
		const { expression } = scriptRanges.exportDefault;
		yield* generateSfcBlockSection(script, expression.start, expression.end, codeFeatures.all);
		yield endOfLine;
	}
	else if (script?.src) {
		yield `let ${names.self}!: typeof import('./${path.basename(fileName)}').default${endOfLine}`;
	}
}

function* generateTemplateCtx(
	{ vueCompilerOptions, script, scriptRanges, styles, scriptSetupRanges, fileName }: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
): Generator<Code> {
	const exps: Iterable<Code>[] = [];
	const emitTypes: string[] = [];
	const propTypes: string[] = [];

	if (vueCompilerOptions.petiteVueExtensions.some(ext => fileName.endsWith(ext))) {
		exps.push([`globalThis`]);
	}
	if (script?.src || scriptRanges?.exportDefault) {
		exps.push([`{} as InstanceType<__VLS_PickNotAny<typeof ${names.self}, new () => {}>>`]);
	}
	else {
		exps.push([`{} as import('${vueCompilerOptions.lib}').ComponentPublicInstance`]);
	}
	if (styles.some(style => style.module)) {
		exps.push([`{} as __VLS_StyleModules`]);
	}

	if (scriptSetupRanges?.defineEmits) {
		const { defineEmits } = scriptSetupRanges;
		emitTypes.push(`typeof ${defineEmits.name ?? names.emit}`);
	}
	if (scriptSetupRanges?.defineModel.length) {
		emitTypes.push(`typeof ${names.modelEmit}`);
	}
	if (emitTypes.length) {
		yield `type ${names.EmitProps} = __VLS_EmitsToProps<__VLS_NormalizeEmits<${emitTypes.join(` & `)}>>${endOfLine}`;
		exps.push([`{} as { $emit: ${emitTypes.join(` & `)} }`]);
	}

	const { defineProps, withDefaults } = scriptSetupRanges ?? {};
	const props = defineProps?.arg
		? `typeof ${defineProps.name ?? names.props}`
		: defineProps?.typeArg
		? withDefaults?.arg
			? `__VLS_WithDefaultsGlobal<${names.Props}, typeof ${names.defaults}>`
			: `${names.Props}`
		: undefined;
	if (props) {
		propTypes.push(props);
	}
	if (scriptSetupRanges?.defineModel.length) {
		propTypes.push(names.ModelProps);
	}
	if (emitTypes.length) {
		propTypes.push(names.EmitProps);
	}
	if (propTypes.length) {
		yield `type ${names.InternalProps} = ${propTypes.join(` & `)}${endOfLine}`;
		exps.push([`{} as { $props: ${names.InternalProps} }`]);
		exps.push([`{} as ${names.InternalProps}`]);
	}

	if (scriptSetupRanges && ctx.bindingNames.size) {
		exps.push([`{} as ${names.Bindings}`]);
	}

	yield `const ${names.ctx} = `;
	yield* generateSpreadMerge(exps);
	yield endOfLine;
}

function* generateTemplateComponents(options: ScriptCodegenOptions): Generator<Code> {
	const types: string[] = [`typeof ${names.ctx}`];

	if (options.script && options.scriptRanges?.componentOptions?.components) {
		const { components } = options.scriptRanges.componentOptions;
		yield `const __VLS_componentsOption = `;
		yield* generateSfcBlockSection(
			options.script,
			components.start,
			components.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`typeof __VLS_componentsOption`);
	}

	yield `type __VLS_LocalComponents = ${types.join(` & `)}${endOfLine}`;
	yield `let ${names.components}!: __VLS_LocalComponents & __VLS_GlobalComponents${endOfLine}`;
}

function* generateTemplateDirectives(options: ScriptCodegenOptions): Generator<Code> {
	const types: string[] = [`typeof ${names.ctx}`];

	if (options.script && options.scriptRanges?.componentOptions?.directives) {
		const { directives } = options.scriptRanges.componentOptions;
		yield `const __VLS_directivesOption = `;
		yield* generateSfcBlockSection(
			options.script,
			directives.start,
			directives.end,
			codeFeatures.navigation,
		);
		yield endOfLine;
		types.push(`__VLS_ResolveDirectives<typeof __VLS_directivesOption>`);
	}

	yield `type __VLS_LocalDirectives = ${types.join(` & `)}${endOfLine}`;
	yield `let ${names.directives}!: __VLS_LocalDirectives & __VLS_GlobalDirectives${endOfLine}`;
}

function* generateCssVars(
	options: ScriptCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
	for (const style of options.styles) {
		for (const binding of style.bindings) {
			yield* generateInterpolation(
				options,
				ctx,
				style,
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
	if (!options.scriptSetup || !ctx.bindingNames.size) {
		return;
	}

	const usageVars = new Set([
		...options.templateComponents.flatMap(c => [camelize(c), capitalize(camelize(c))]),
		...options.templateCodegen?.accessExternalVariables.keys() ?? [],
		...templateCodegenCtx.accessExternalVariables.keys(),
	]);

	yield `type ${names.Bindings} = __VLS_ProxyRefs<{${newLine}`;
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
