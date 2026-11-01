import type { ScriptSetupRanges } from '@vue/language-core';
import { names } from '../names';
import type { TsCode } from '../tsCode';
import { asType, asTypeCode, intersectTypes, newLine, typeAliasRef } from '../writers';
import { generateSpreadMerge } from '../writers/merge';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';
import { type ComponentProps, getComponentEmits, getComponentProps, getExposeTypes } from './scriptSetup';

/** The slots of the options of a script setup component. */
export interface ComponentSlots {
	/** Options of the component, after its props, e.g. `__typeEl: …`. */
	componentOptions: (readonly TsCode[])[];
	/**
	 * Object types of the props that the component takes besides those that it declares, e.g. the attributes that
	 * fall through to its root; the keys of its emit props are omitted from them.
	 */
	fallthroughProps: string[];
}

export function* generateComponent(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<TsCode> {
	yield `(await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;

	if (options.slots.expose.length) {
		yield `setup: () => (`;
		yield* asTypeCode(intersectTypes(getExposeTypes(options, scriptSetupRanges)), options.scriptLang);
		yield `),${newLine}`;
	}
	else if (scriptSetupRanges.defineExpose) {
		yield `setup: () => ${names.exposed},${newLine}`;
	}

	const emitOptionCodes = [...generateEmitsOption(options)];
	yield* emitOptionCodes;
	yield* generatePropsOption(options, ctx, !!emitOptionCodes.length);

	for (const option of options.slots.componentOptions) {
		yield* option;
		yield `,${newLine}`;
	}
	yield `})`;
}

function* generateEmitsOption(options: ScriptCodegenOptions): Generator<TsCode> {
	const { types, functions } = getComponentEmits(options);
	if (options.vueCompilerOptions.target >= 3.5 && types?.length) {
		yield `__typeEmits: `;
		yield* asTypeCode(intersectTypes(types), options.scriptLang);
		yield `,${newLine}`;
	}
	else if (functions.length) {
		yield `emits: `;
		yield* generateSpreadMerge(
			...functions.map(emit => asType(`${names.NormalizeEmits}<${emit}>`, options.scriptLang)),
		);
		yield `,${newLine}`;
	}
}

function* generatePropsOption(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	hasEmitsOption: boolean,
): Generator<TsCode> {
	const props = getComponentProps(options);
	const typeCodes = options.vueCompilerOptions.target >= 3.5 && !props.runtime.length
		? [...generateTypePropsOption(options, ctx, hasEmitsOption)]
		: [];

	// the instance type of a component gives the props that have defaults through the runtime option, also next to
	// `__typeProps`
	const runtimeCodes = props.defaults || !typeCodes.length
		? [...generateRuntimePropsOption(options, ctx, props, hasEmitsOption, !!typeCodes.length)]
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
	for (const type of options.slots.fallthroughProps) {
		yield asType(omitEmitProps(options, type, hasEmitsOption), options.scriptLang);
	}
	if (ctx.generatedTypes.has(names.PublicProps)) {
		yield asType(typeAliasRef(names.PublicProps, options.scriptLang), options.scriptLang);
	}
}

function* generateRuntimePropsOption(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	{ types, runtime, defaults }: ComponentProps,
	hasEmitsOption: boolean,
	hasTypeProps: boolean,
): Generator<string | readonly TsCode[]> {
	for (const type of hasTypeProps ? [] : options.slots.fallthroughProps) {
		const propsType = ctx.localTypes.TypePropsToOption(
			`${names.PickNotAny}<${ctx.localTypes.OmitIndexSignature(omitEmitProps(options, type, hasEmitsOption))}, {}>`,
		);
		yield asType(propsType, options.scriptLang);
	}
	// the runtime options alone type the props of a 3.6 component, but not the props of types
	if (
		!hasTypeProps
		&& ctx.generatedTypes.has(names.PublicProps)
		&& (options.vueCompilerOptions.target < 3.6 || (types.length && runtime.length))
	) {
		yield asType(
			ctx.localTypes.TypePropsToOption(typeAliasRef(names.PublicProps, options.scriptLang)),
			options.scriptLang,
		);
	}
	yield* runtime;
	// last, so that a prop with a default takes its option from it
	if (defaults) {
		yield asType(
			ctx.localTypes.WithDefaults(defaults.props.join(' & '), defaults.defaults.join(' & ')),
			options.scriptLang,
		);
	}
}

function omitEmitProps(options: ScriptCodegenOptions, type: string, hasEmitsOption: boolean) {
	return hasEmitsOption ? `Omit<${type}, keyof ${typeAliasRef(names.EmitProps, options.scriptLang)}>` : type;
}
