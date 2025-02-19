import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';

export function* generateComponent(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	if (options.sfc.script && options.scriptRanges?.exportDefault && options.scriptRanges.exportDefault.expression.start !== options.scriptRanges.exportDefault.args.start) {
		// use defineComponent() from user space code if it exist
		yield generateSfcBlockSection(options.sfc.script, options.scriptRanges.exportDefault.expression.start, options.scriptRanges.exportDefault.args.start, codeFeatures.all);
		yield `{${newLine}`;
	}
	else {
		yield `(await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;
	}

	yield `setup() {${newLine}`;
	yield `return {${newLine}`;
	if (ctx.bypassDefineComponent) {
		yield* generateComponentSetupReturns(scriptSetupRanges);
	}
	if (scriptSetupRanges.defineExpose) {
		yield `...__VLS_exposed,${newLine}`;
	}
	yield `}${endOfLine}`;
	yield `},${newLine}`;
	if (!ctx.bypassDefineComponent) {
		const emitOptionCodes = [...generateEmitsOption(options, scriptSetupRanges)];
		for (const code of emitOptionCodes) {
			yield code;
		}
		yield* generatePropsOption(options, ctx, scriptSetup, scriptSetupRanges, !!emitOptionCodes.length, true);
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
		&& options.templateCodegen?.singleRootElTypes.length
	) {
		yield `__typeEl: {} as __VLS_RootEl,${newLine}`;
	}
	if (options.sfc.script && options.scriptRanges?.exportDefault?.args) {
		const { args } = options.scriptRanges.exportDefault;
		yield generateSfcBlockSection(options.sfc.script, args.start + 1, args.end - 1, codeFeatures.all);
	}
	yield `})`;
}

export function* generateComponentSetupReturns(scriptSetupRanges: ScriptSetupRanges): Generator<Code> {
	// fill $props
	if (scriptSetupRanges.defineProps) {
		// NOTE: defineProps is inaccurate for $props
		yield `$props: __VLS_makeOptional(${scriptSetupRanges.defineProps.name ?? `__VLS_props`}),${newLine}`;
		yield `...${scriptSetupRanges.defineProps.name ?? `__VLS_props`},${newLine}`;
	}
	// fill $emit
	if (scriptSetupRanges.defineEmits) {
		yield `$emit: ${scriptSetupRanges.defineEmits.name ?? '__VLS_emit'},${newLine}`;
	}
}

export function* generateEmitsOption(
	options: ScriptCodegenOptions,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	const codes: {
		// undefined means the emit source cannot be explained by expression
		optionExp?: Code,
		// undefined means the emit source cannot be explained by type
		typeOptionType?: Code,
	}[] = [];
	if (scriptSetupRanges.defineProp.some(p => p.isModel)) {
		codes.push({
			optionExp: `{} as __VLS_NormalizeEmits<typeof __VLS_modelEmit>`,
			typeOptionType: `__VLS_ModelEmit`,
		});
	}
	if (scriptSetupRanges.defineEmits) {
		const { name, typeArg, hasUnionTypeArg } = scriptSetupRanges.defineEmits;
		codes.push({
			optionExp: `{} as __VLS_NormalizeEmits<typeof ${name ?? '__VLS_emit'}>`,
			typeOptionType: typeArg && !hasUnionTypeArg
				? `__VLS_Emit`
				: undefined,
		});
	}
	if (options.vueCompilerOptions.target >= 3.5 && codes.every(code => code.typeOptionType)) {
		if (codes.length === 1) {
			yield `__typeEmits: {} as `;
			yield codes[0].typeOptionType!;
			yield `,${newLine}`;
		}
		else if (codes.length >= 2) {
			yield `__typeEmits: {} as `;
			yield codes[0].typeOptionType!;
			for (let i = 1; i < codes.length; i++) {
				yield ` & `;
				yield codes[i].typeOptionType!;
			}
			yield `,${newLine}`;
		}
	}
	else if (codes.every(code => code.optionExp)) {
		if (codes.length === 1) {
			yield `emits: `;
			yield codes[0].optionExp!;
			yield `,${newLine}`;
		}
		else if (codes.length >= 2) {
			yield `emits: {${newLine}`;
			for (const code of codes) {
				yield `...`;
				yield code.optionExp!;
				yield `,${newLine}`;
			}
			yield `},${newLine}`;
		}
	}
}

export function* generatePropsOption(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	hasEmitsOption: boolean,
	inheritAttrs: boolean
): Generator<Code> {
	const codes: {
		optionExp: Code,
		// undefined means the prop source cannot be explained by type
		typeOptionExp?: Code,
	}[] = [];

	if (ctx.generatedPropsType) {
		codes.push({
			optionExp: [
				`{} as `,
				scriptSetupRanges.withDefaults?.arg ? `${ctx.localTypes.WithDefaults}<` : '',
				`${ctx.localTypes.TypePropsToOption}<__VLS_PublicProps>`,
				scriptSetupRanges.withDefaults?.arg ? `, typeof __VLS_withDefaultsArg>` : '',
			].join(''),
			typeOptionExp: `{} as __VLS_PublicProps`,
		});
	}
	if (scriptSetupRanges.defineProps?.arg) {
		const { arg } = scriptSetupRanges.defineProps;
		codes.push({
			optionExp: generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.navigation),
			typeOptionExp: undefined,
		});
	}
	if (inheritAttrs && options.templateCodegen?.inheritedAttrVars.size) {
		let attrsType = `Partial<__VLS_InheritedAttrs>`;
		if (hasEmitsOption) {
			attrsType = `Omit<${attrsType}, \`on\${string}\`>`;
		}
		const propsType = `__VLS_PickNotAny<${ctx.localTypes.OmitIndexSignature}<${attrsType}>, {}>`;
		const optionType = `${ctx.localTypes.TypePropsToOption}<${propsType}>`;
		codes.unshift({
			optionExp: codes.length
				? `{} as ${optionType}`
				// workaround for https://github.com/vuejs/core/pull/7419
				: `{} as keyof ${propsType} extends never ? never: ${optionType}`,
			typeOptionExp: `{} as ${attrsType}`,
		});
	}

	const useTypeOption = options.vueCompilerOptions.target >= 3.5 && codes.every(code => code.typeOptionExp);
	const useOption = !useTypeOption || scriptSetupRanges.withDefaults;

	if (useTypeOption) {
		if (codes.length === 1) {
			yield `__typeProps: `;
			yield codes[0].typeOptionExp!;
			yield `,${newLine}`;
		}
		else if (codes.length >= 2) {
			yield `__typeProps: {${newLine}`;
			for (const { typeOptionExp } of codes) {
				yield `...`;
				yield typeOptionExp!;
				yield `,${newLine}`;
			}
			yield `},${newLine}`;
		}
	}
	if (useOption) {
		if (codes.length === 1) {
			yield `props: `;
			yield codes[0].optionExp;
			yield `,${newLine}`;
		}
		else if (codes.length >= 2) {
			yield `props: {${newLine}`;
			for (const { optionExp } of codes) {
				yield `...`;
				yield optionExp;
				yield `,${newLine}`;
			}
			yield `},${newLine}`;
		}
	}
}
