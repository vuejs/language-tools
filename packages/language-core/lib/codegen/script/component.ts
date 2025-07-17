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
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	if (
		options.sfc.script && options.scriptRanges?.exportDefault
		&& options.scriptRanges.exportDefault.expression.start !== options.scriptRanges.exportDefault.args.start
	) {
		// use defineComponent() from user space code if it exist
		yield generateSfcBlockSection(
			options.sfc.script,
			options.scriptRanges.exportDefault.expression.start,
			options.scriptRanges.exportDefault.args.start,
			codeFeatures.all,
		);
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
		yield* emitOptionCodes;
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
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	const optionCodes: Code[] = [];
	const typeOptionCodes: Code[] = [];

	if (scriptSetupRanges.defineModel.length) {
		optionCodes.push(`{} as __VLS_NormalizeEmits<typeof __VLS_modelEmit>`);
		typeOptionCodes.push(`__VLS_ModelEmit`);
	}
	if (scriptSetupRanges.defineEmits) {
		const { name, typeArg, hasUnionTypeArg } = scriptSetupRanges.defineEmits;
		optionCodes.push(`{} as __VLS_NormalizeEmits<typeof ${name ?? '__VLS_emit'}>`);
		if (typeArg && !hasUnionTypeArg) {
			typeOptionCodes.push(`__VLS_Emit`);
		}
		else {
			typeOptionCodes.length = 0;
		}
	}

	if (options.vueCompilerOptions.target >= 3.5 && typeOptionCodes.length) {
		yield* generateIntersectMerge('__typeEmits', typeOptionCodes);
	}
	else if (optionCodes.length) {
		yield* generateSpreadMerge('emits', optionCodes);
	}
}

export function* generatePropsOption(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	hasEmitsOption: boolean,
	inheritAttrs: boolean,
): Generator<Code> {
	const getOptionCodes: (() => Code)[] = [];
	const typeOptionCodes: Code[] = [];

	if (inheritAttrs && options.templateCodegen?.inheritedAttrVars.size) {
		let attrsType = `Partial<__VLS_InheritedAttrs>`;
		if (hasEmitsOption) {
			attrsType = `Omit<${attrsType}, \`on\${string}\`>`;
		}
		getOptionCodes.push(() => {
			const propsType = `__VLS_PickNotAny<${ctx.localTypes.OmitIndexSignature}<${attrsType}>, {}>`;
			const optionType = `${ctx.localTypes.TypePropsToOption}<${propsType}>`;
			return `{} as ${optionType}`;
		});
		typeOptionCodes.push(`{} as ${attrsType}`);
	}
	if (ctx.generatedPropsType) {
		if (options.vueCompilerOptions.target < 3.6) {
			getOptionCodes.push(() => {
				const propsType = `${ctx.localTypes.TypePropsToOption}<__VLS_PublicProps>`;
				return `{} as ` + (
					scriptSetupRanges.withDefaults?.arg
						? `${ctx.localTypes.WithDefaults}<${propsType}, typeof __VLS_withDefaultsArg>`
						: propsType
				);
			});
		}
		typeOptionCodes.push(`{} as __VLS_PublicProps`);
	}
	if (scriptSetupRanges.defineProps?.arg) {
		const { arg } = scriptSetupRanges.defineProps;
		getOptionCodes.push(() => generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.navigation));
		typeOptionCodes.length = 0;
	}

	const useTypeOption = options.vueCompilerOptions.target >= 3.5 && typeOptionCodes.length;
	const useOption = (!useTypeOption || scriptSetupRanges.withDefaults) && getOptionCodes.length;

	if (useTypeOption) {
		if (
			options.vueCompilerOptions.target >= 3.6
			&& scriptSetupRanges.withDefaults?.arg
		) {
			yield `__defaults: __VLS_withDefaultsArg,${newLine}`;
		}
		yield* generateSpreadMerge('__typeProps', typeOptionCodes);
	}
	if (useOption) {
		yield* generateSpreadMerge('props', getOptionCodes.map(fn => fn()));
	}
}

function* generateIntersectMerge(key: string, codes: Code[]): Generator<Code> {
	yield `${key}: {} as `;
	yield codes[0];
	for (let i = 1; i < codes.length; i++) {
		yield ` & `;
		yield codes[i];
	}
	yield `,${newLine}`;
}

function* generateSpreadMerge(key: string, codes: Code[]): Generator<Code> {
	yield `${key}: `;
	if (codes.length === 1) {
		yield codes[0];
	}
	else {
		yield `{${newLine}`;
		for (const code of codes) {
			yield `...`;
			yield code;
			yield `,${newLine}`;
		}
		yield `}`;
	}
	yield `,${newLine}`;
}
