import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, IRScriptSetup } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { asType, generateSfcBlockSection, newLine } from '../utils';
import { generateSpreadMerge } from '../utils/merge';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';

export function* generateComponent(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	yield `(await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;

	if (scriptSetupRanges.defineExpose) {
		yield `setup: () => ${names.exposed},${newLine}`;
	}

	const emitOptionCodes = [...generateEmitsOption(options, scriptSetupRanges)];
	yield* emitOptionCodes;
	yield* generatePropsOption(options, ctx, scriptSetup, scriptSetupRanges, !!emitOptionCodes.length);

	if (
		options.vueCompilerOptions.target >= 3.5
		&& options.vueCompilerOptions.inferComponentDollarRefs
		&& options.templateAndStyleTypes.has(names.TemplateRefs)
	) {
		yield `__typeRefs: ${asType('{}', names.TemplateRefs, options.scriptLang)},${newLine}`;
	}
	if (
		options.vueCompilerOptions.target >= 3.5
		&& options.vueCompilerOptions.inferComponentDollarEl
		&& options.templateAndStyleTypes.has(names.RootEl)
	) {
		yield `__typeEl: ${asType('{}', names.RootEl, options.scriptLang)},${newLine}`;
	}
	yield `})`;
}

function* generateEmitsOption(
	options: ScriptCodegenOptions,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<Code> {
	const typeCodes = options.vueCompilerOptions.target >= 3.5 && !scriptSetupRanges.defineEmits?.hasUnionTypeArg
		? [...generateTypeEmitsOption(scriptSetupRanges)]
		: [];

	const runtimeCodes = !typeCodes.length
		? [...generateRuntimeEmitsOption(options, scriptSetupRanges)]
		: [];

	if (typeCodes.length) {
		yield `__typeEmits: ${asType('{}', typeCodes.join(` & `), options.scriptLang)},${newLine}`;
	}
	else if (runtimeCodes.length) {
		yield `emits: `;
		yield* generateSpreadMerge(...runtimeCodes);
		yield `,${newLine}`;
	}
}

function* generateTypeEmitsOption(scriptSetupRanges: ScriptSetupRanges): Generator<string> {
	if (scriptSetupRanges.defineModel.length) {
		yield names.ModelEmit;
	}
	if (scriptSetupRanges.defineEmits?.typeArg) {
		yield names.Emit;
	}
}

function* generateRuntimeEmitsOption(
	options: ScriptCodegenOptions,
	scriptSetupRanges: ScriptSetupRanges,
): Generator<string> {
	if (scriptSetupRanges.defineModel.length) {
		yield asType('{}', `${names.NormalizeEmits}<typeof ${names.modelEmit}>`, options.scriptLang);
	}
	if (scriptSetupRanges.defineEmits) {
		yield asType(
			'{}',
			`${names.NormalizeEmits}<typeof ${scriptSetupRanges.defineEmits.name ?? names.emit}>`,
			options.scriptLang,
		);
	}
}

function* generatePropsOption(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
	hasEmitsOption: boolean,
): Generator<Code> {
	const typeCodes = options.vueCompilerOptions.target >= 3.5 && !scriptSetupRanges.defineProps?.arg
		? [...generateTypePropsOption(options, ctx, hasEmitsOption)]
		: [];

	const runtimeCodes = scriptSetupRanges.withDefaults || !typeCodes.length
		? [...generateRuntimePropsOption(options, ctx, scriptSetup, scriptSetupRanges, hasEmitsOption)]
		: [];

	if (typeCodes.length) {
		if (options.vueCompilerOptions.target >= 3.6 && scriptSetupRanges.withDefaults?.arg) {
			yield `__defaults: ${names.defaults},${newLine}`;
		}
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
): Generator<Code> {
	if (options.templateAndStyleTypes.has(names.InheritedAttrs)) {
		const attrsType = hasEmitsOption
			? `Omit<${names.InheritedAttrs}, keyof ${names.EmitProps}>`
			: names.InheritedAttrs;
		yield asType('{}', attrsType, options.scriptLang);
	}
	if (ctx.generatedTypes.has(names.PublicProps)) {
		yield asType('{}', names.PublicProps, options.scriptLang);
	}
}

function* generateRuntimePropsOption(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: IRScriptSetup,
	scriptSetupRanges: ScriptSetupRanges,
	hasEmitsOption: boolean,
): Generator<Code> {
	if (options.templateAndStyleTypes.has(names.InheritedAttrs)) {
		const attrsType = hasEmitsOption
			? `Omit<${names.InheritedAttrs}, keyof ${names.EmitProps}>`
			: names.InheritedAttrs;
		const propsType =
			`${ctx.localTypes.TypePropsToOption}<${names.PickNotAny}<${ctx.localTypes.OmitIndexSignature}<${attrsType}>, {}>>`;
		yield asType('{}', propsType, options.scriptLang);
	}
	if (ctx.generatedTypes.has(names.PublicProps) && options.vueCompilerOptions.target < 3.6) {
		let propsType = `${ctx.localTypes.TypePropsToOption}<${names.PublicProps}>`;
		if (scriptSetupRanges.withDefaults?.arg) {
			propsType = `${ctx.localTypes.WithDefaults}<${propsType}, typeof ${names.defaults}>`;
		}
		yield asType('{}', propsType, options.scriptLang);
	}
	if (scriptSetupRanges.defineProps?.arg) {
		const { arg } = scriptSetupRanges.defineProps;
		yield* generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.navigation);
	}
}
