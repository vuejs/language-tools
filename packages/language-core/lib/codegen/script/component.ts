import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, IRScriptSetup } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { generateSfcBlockSection, newLine } from '../utils';
import { generateIntersectMerge, generateSpreadMerge } from '../utils/merge';
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
		yield `__typeRefs: {} as ${names.TemplateRefs},${newLine}`;
	}
	if (
		options.vueCompilerOptions.target >= 3.5
		&& options.vueCompilerOptions.inferComponentDollarEl
		&& options.templateAndStyleTypes.has(names.RootEl)
	) {
		yield `__typeEl: {} as ${names.RootEl},${newLine}`;
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
		? [...generateRuntimeEmitsOption(scriptSetupRanges)]
		: [];

	if (typeCodes.length) {
		yield `__typeEmits: {} as `;
		yield* generateIntersectMerge(...typeCodes);
		yield `,${newLine}`;
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

function* generateRuntimeEmitsOption(scriptSetupRanges: ScriptSetupRanges): Generator<string> {
	if (scriptSetupRanges.defineModel.length) {
		yield `{} as ${names.NormalizeEmits}<typeof ${names.modelEmit}>`;
	}
	if (scriptSetupRanges.defineEmits) {
		yield `{} as ${names.NormalizeEmits}<typeof ${scriptSetupRanges.defineEmits.name ?? names.emit}>`;
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
		yield `{} as ${attrsType}`;
	}
	if (ctx.generatedTypes.has(names.PublicProps)) {
		yield `{} as ${names.PublicProps}`;
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
		yield `{} as ${propsType}`;
	}
	if (ctx.generatedTypes.has(names.PublicProps) && options.vueCompilerOptions.target < 3.6) {
		let propsType = `${ctx.localTypes.TypePropsToOption}<${names.PublicProps}>`;
		if (scriptSetupRanges.withDefaults?.arg) {
			propsType = `${ctx.localTypes.WithDefaults}<${propsType}, typeof ${names.defaults}>`;
		}
		yield `{} as ${propsType}`;
	}
	if (scriptSetupRanges.defineProps?.arg) {
		const { arg } = scriptSetupRanges.defineProps;
		yield* generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.navigation);
	}
}
