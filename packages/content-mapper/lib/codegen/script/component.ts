import { type IRScriptSetup, navigationFeatures, type ScriptSetupRanges } from '@vue/language-core';
import { names } from '../names';
import type { TsCode } from '../tsCode';
import { asType, asTypeCode, generateSfcBlockSection, intersectTypes, newLine, typeAliasRef } from '../writers';
import { generateSpreadMerge } from '../writers/merge';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';
import { getExposeTypes } from './scriptSetup';

/** The slots of the options of a script setup component. */
export interface ComponentSlots {
	/** Options of the component, after its props, e.g. `__typeEl: …`. */
	componentOptions: string[];
}

export function* generateComponent(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<TsCode> {
	yield `(await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;

	if (options.expose.length) {
		yield `setup: () => (`;
		yield* asTypeCode(intersectTypes(getExposeTypes(options, scriptSetupRanges)), options.scriptLang);
		yield `),${newLine}`;
	}
	else if (scriptSetupRanges.defineExpose) {
		yield `setup: () => ${names.exposed},${newLine}`;
	}

	const emitOptionCodes = [...generateEmitsOption(options, scriptSetupRanges)];
	yield* emitOptionCodes;
	yield* generatePropsOption(options, ctx, scriptSetup, scriptSetupRanges, !!emitOptionCodes.length);

	for (const option of options.slots.componentOptions) {
		yield `${option},${newLine}`;
	}
	yield `})`;
}

function* generateEmitsOption(
	options: ScriptCodegenOptions,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<TsCode> {
	const typeCodes = options.vueCompilerOptions.target >= 3.5 && !scriptSetupRanges.defineEmits?.hasUnionTypeArg
		? [...generateTypeEmitsOption(options, scriptSetupRanges)]
		: [];

	const runtimeCodes = !typeCodes.length
		? [...generateRuntimeEmitsOption(options, scriptSetupRanges)]
		: [];

	if (typeCodes.length) {
		yield `__typeEmits: `;
		yield* asTypeCode(intersectTypes(typeCodes), options.scriptLang);
		yield `,${newLine}`;
	}
	else if (runtimeCodes.length) {
		yield `emits: `;
		yield* generateSpreadMerge(...runtimeCodes);
		yield `,${newLine}`;
	}
}

function* generateTypeEmitsOption(
	options: ScriptCodegenOptions,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<string | TsCode[]> {
	if (scriptSetupRanges.defineModel.length) {
		yield typeAliasRef(names.ModelEmit, options.scriptLang);
	}
	if (scriptSetupRanges.defineEmits?.typeArg) {
		yield names.Emit;
	}
	yield* options.emits;
}

function* generateRuntimeEmitsOption(
	options: ScriptCodegenOptions,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<string | TsCode[]> {
	if (scriptSetupRanges.defineModel.length) {
		yield asType(`${names.NormalizeEmits}<typeof ${names.modelEmit}>`, options.scriptLang);
	}
	if (scriptSetupRanges.defineEmits) {
		yield asType(
			`${names.NormalizeEmits}<typeof ${scriptSetupRanges.defineEmits.name ?? names.emit}>`,
			options.scriptLang,
		);
	}
	for (const type of options.emits) {
		yield asTypeCode([`${names.NormalizeEmits}<${names.ShortEmits}<`, ...type, `>>`], options.scriptLang);
	}
}

function* generatePropsOption(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
	hasEmitsOption: boolean,
): Generator<TsCode> {
	const typeCodes = options.vueCompilerOptions.target >= 3.5 && !scriptSetupRanges.defineProps?.arg
		? [...generateTypePropsOption(options, ctx, hasEmitsOption)]
		: [];

	// the instance type of a component gives the props that have defaults through the runtime option, also next to
	// `__typeProps`
	const runtimeCodes = ctx.propDefaults || !typeCodes.length
		? [...generateRuntimePropsOption(options, ctx, scriptSetup, scriptSetupRanges, hasEmitsOption, !!typeCodes.length)]
		: [];

	if (typeCodes.length) {
		yield `__typeProps: `;
		yield* generateSpreadMerge(...typeCodes);
		yield `,${newLine}`;
	}
	if (runtimeCodes.length) {
		yield `props: `;
		yield* generateSpreadMerge(...runtimeCodes);
		yield `,${newLine}`;
	}
}

function* generateTypePropsOption(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	hasEmitsOption: boolean,
): Generator<string> {
	if (options.templateTypes.has(names.InheritedAttrs)) {
		const attrsType = getInheritedAttrsType(options, hasEmitsOption);
		yield asType(attrsType, options.scriptLang);
	}
	if (ctx.generatedTypes.has(names.PublicProps)) {
		yield asType(typeAliasRef(names.PublicProps, options.scriptLang), options.scriptLang);
	}
}

function* generateRuntimePropsOption(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
	hasEmitsOption: boolean,
	hasTypeProps: boolean,
): Generator<string | TsCode[]> {
	if (!hasTypeProps && options.templateTypes.has(names.InheritedAttrs)) {
		const attrsType = getInheritedAttrsType(options, hasEmitsOption);
		const propsType = ctx.localTypes.TypePropsToOption(
			`${names.PickNotAny}<${ctx.localTypes.OmitIndexSignature(attrsType)}, {}>`,
		);
		yield asType(propsType, options.scriptLang);
	}
	// a runtime `defineProps` argument alone types the props of a 3.6 component, but not its models or the props of
	// plugins
	if (
		!hasTypeProps
		&& ctx.generatedTypes.has(names.PublicProps)
		&& (
			options.vueCompilerOptions.target < 3.6
			|| ((options.props.length || scriptSetupRanges.defineModel.length) && scriptSetupRanges.defineProps?.arg)
		)
	) {
		yield asType(
			ctx.localTypes.TypePropsToOption(typeAliasRef(names.PublicProps, options.scriptLang)),
			options.scriptLang,
		);
	}
	if (scriptSetupRanges.defineProps?.arg) {
		const { arg } = scriptSetupRanges.defineProps;
		yield [...generateSfcBlockSection(
			scriptSetup,
			arg.start,
			arg.end,
			{ features: navigationFeatures },
			true,
		)];
	}
	// last, so that a prop with a default takes its option from it
	if (ctx.propDefaults) {
		const { props, defaults } = ctx.propDefaults;
		yield asType(ctx.localTypes.WithDefaults(props.join(' & '), defaults.join(' & ')), options.scriptLang);
	}
}

function getInheritedAttrsType(options: ScriptCodegenOptions, hasEmitsOption: boolean) {
	const inheritedAttrs = typeAliasRef(names.InheritedAttrs, options.scriptLang);
	return hasEmitsOption
		? `Omit<${inheritedAttrs}, keyof ${typeAliasRef(names.EmitProps, options.scriptLang)}>`
		: inheritedAttrs;
}
