import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { generateSfcBlockSection, newLine } from '../utils';
import { generateIntersectMerge, generateSpreadMerge } from '../utils/merge';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';

export function* generateComponent(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	if (
		options.script
		&& options.scriptRanges?.componentOptions
		&& options.scriptRanges.componentOptions.expression.start !== options.scriptRanges.componentOptions.args.start
	) {
		// use defineComponent() from user space code if it exist
		yield* generateSfcBlockSection(
			options.script,
			options.scriptRanges.componentOptions.expression.start,
			options.scriptRanges.componentOptions.args.start,
			codeFeatures.all,
		);
		yield `{${newLine}`;
	}
	else {
		yield `(await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;
	}

	const returns: string[][] = [];
	if (ctx.bypassDefineComponent) {
		// fill $props
		if (scriptSetupRanges.defineProps) {
			const name = scriptSetupRanges.defineProps.name ?? `__VLS_props`;
			// NOTE: defineProps is inaccurate for $props
			returns.push([name]);
			returns.push([`{} as { $props: Partial<typeof ${name}> }`]);
		}
		// fill $emit
		if (scriptSetupRanges.defineEmits) {
			returns.push([`{} as { $emit: typeof ${scriptSetupRanges.defineEmits.name ?? `__VLS_emit`} }`]);
		}
	}
	if (scriptSetupRanges.defineExpose) {
		returns.push([`__VLS_exposed`]);
	}
	if (returns.length) {
		yield `setup: () => (`;
		yield* generateSpreadMerge(returns);
		yield `),${newLine}`;
	}

	if (!ctx.bypassDefineComponent) {
		const emitOptionCodes = [...generateEmitsOption(options, scriptSetupRanges)];
		yield* emitOptionCodes;
		yield* generatePropsOption(options, ctx, scriptSetup, scriptSetupRanges, !!emitOptionCodes.length);
	}
	if (
		options.vueCompilerOptions.target >= 3.5
		&& options.vueCompilerOptions.inferComponentDollarRefs
		&& options.templateCodegen?.templateRefs.size
	) {
		yield `__typeRefs: {} as __VLS_TemplateRefs,${newLine}`;
	}
	if (
		options.vueCompilerOptions.target >= 3.5
		&& options.vueCompilerOptions.inferComponentDollarEl
		&& options.templateCodegen?.singleRootElTypes.size
	) {
		yield `__typeEl: {} as __VLS_RootEl,${newLine}`;
	}
	if (options.script && options.scriptRanges?.componentOptions?.args) {
		const { args } = options.scriptRanges.componentOptions;
		yield* generateSfcBlockSection(options.script, args.start + 1, args.end - 1, codeFeatures.all);
	}
	yield `})`;
}

function* generateEmitsOption(
	options: ScriptCodegenOptions,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	const optionCodes: Code[][] = [];
	const typeOptionCodes: Code[][] = [];

	if (scriptSetupRanges.defineModel.length) {
		optionCodes.push([`{} as __VLS_NormalizeEmits<typeof __VLS_modelEmit>`]);
		typeOptionCodes.push([`__VLS_ModelEmit`]);
	}
	if (scriptSetupRanges.defineEmits) {
		const { name, typeArg, hasUnionTypeArg } = scriptSetupRanges.defineEmits;
		optionCodes.push([`{} as __VLS_NormalizeEmits<typeof ${name ?? '__VLS_emit'}>`]);
		if (typeArg && !hasUnionTypeArg) {
			typeOptionCodes.push([`__VLS_Emit`]);
		}
		else {
			typeOptionCodes.length = 0;
		}
	}

	if (options.vueCompilerOptions.target >= 3.5 && typeOptionCodes.length) {
		yield `__typeEmits: {} as `;
		yield* generateIntersectMerge(typeOptionCodes);
		yield `,${newLine}`;
	}
	else if (optionCodes.length) {
		yield `emits: `;
		yield* generateSpreadMerge(optionCodes);
		yield `,${newLine}`;
	}
}

function* generatePropsOption(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	hasEmitsOption: boolean,
): Generator<Code> {
	const optionGenerates: Iterable<Code>[] = [];
	const typeOptionGenerates: Iterable<Code>[] = [];

	if (options.templateCodegen?.inheritedAttrVars.size) {
		let attrsType = `__VLS_InheritedAttrs`;
		if (hasEmitsOption) {
			attrsType = `Omit<${attrsType}, keyof __VLS_EmitProps>`;
		}
		const propsType = `__VLS_PickNotAny<${ctx.localTypes.OmitIndexSignature}<${attrsType}>, {}>`;
		const optionType = `${ctx.localTypes.TypePropsToOption}<${propsType}>`;
		optionGenerates.push([`{} as ${optionType}`]);
		typeOptionGenerates.push([`{} as ${attrsType}`]);
	}
	if (ctx.generatedPropsType) {
		if (options.vueCompilerOptions.target < 3.6) {
			let propsType = `${ctx.localTypes.TypePropsToOption}<__VLS_PublicProps>`;
			if (scriptSetupRanges.withDefaults?.arg) {
				propsType = `${ctx.localTypes.WithDefaultsLocal}<${propsType}, typeof __VLS_defaults>`;
			}
			optionGenerates.push([`{} as ${propsType}`]);
		}
		typeOptionGenerates.push([`{} as __VLS_PublicProps`]);
	}
	if (scriptSetupRanges.defineProps?.arg) {
		const { arg } = scriptSetupRanges.defineProps;
		optionGenerates.push(generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.navigation));
		typeOptionGenerates.length = 0;
	}

	const useTypeOption = options.vueCompilerOptions.target >= 3.5 && typeOptionGenerates.length;
	const useOption = (!useTypeOption || scriptSetupRanges.withDefaults) && optionGenerates.length;

	if (useTypeOption) {
		if (
			options.vueCompilerOptions.target >= 3.6
			&& scriptSetupRanges.withDefaults?.arg
		) {
			yield `__defaults: __VLS_defaults,${newLine}`;
		}
		yield `__typeProps: `;
		yield* generateSpreadMerge(typeOptionGenerates);
		yield `,${newLine}`;
	}
	if (useOption) {
		yield `props: `;
		yield* generateSpreadMerge(optionGenerates);
		yield `,${newLine}`;
	}
}
