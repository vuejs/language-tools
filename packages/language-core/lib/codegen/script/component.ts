import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
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
	const returns: Code[] = [];
	if (ctx.bypassDefineComponent) {
		// fill $props
		if (scriptSetupRanges.defineProps) {
			const name = scriptSetupRanges.defineProps.name ?? `__VLS_props`;
			// NOTE: defineProps is inaccurate for $props
			returns.push(`typeof ${name} & { $props: Partial<typeof ${name}> }`);
		}
		// fill $emit
		if (scriptSetupRanges.defineEmits) {
			returns.push(`{ $emit: typeof ${scriptSetupRanges.defineEmits.name ?? '__VLS_emit'} }`);
		}
	}
	if (scriptSetupRanges.defineExpose) {
		returns.push(`typeof __VLS_exposed`);
	}
	if (returns.length) {
		yield `return {} as `;
		yield* generateIntersectMerge(returns);
		yield endOfLine;
	}
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
		yield `__typeProps: `;
		yield* generateSpreadMerge(typeOptionCodes);
		yield `,${newLine}`;
	}
	if (useOption) {
		yield `props: `;
		yield* generateSpreadMerge(getOptionCodes.map(fn => fn()));
		yield `,${newLine}`;
	}
}
