import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
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
	const optionCodes: Code[][] = [];
	const typeOptionCodes: Code[][] = [];

	if (scriptSetupRanges.defineModel.length) {
		optionCodes.push([`{} as ${names.NormalizeEmits}<typeof ${names.modelEmit}>`]);
		typeOptionCodes.push([names.ModelEmit]);
	}
	if (scriptSetupRanges.defineEmits) {
		const { name, typeArg, hasUnionTypeArg } = scriptSetupRanges.defineEmits;
		optionCodes.push([`{} as ${names.NormalizeEmits}<typeof ${name ?? names.emit}>`]);
		if (typeArg && !hasUnionTypeArg) {
			typeOptionCodes.push([names.Emit]);
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
	const optionGenerates: (() => Iterable<Code>)[] = [];
	const typeOptionGenerates: (() => Iterable<Code>)[] = [];

	if (options.templateAndStyleTypes.has(names.InheritedAttrs)) {
		const attrsType = hasEmitsOption
			? `Omit<${names.InheritedAttrs}, keyof ${names.EmitProps}>`
			: names.InheritedAttrs;
		optionGenerates.push(function*() {
			const propsType = `${names.PickNotAny}<${ctx.localTypes.OmitIndexSignature}<${attrsType}>, {}>`;
			const optionType = `${ctx.localTypes.TypePropsToOption}<${propsType}>`;
			yield `{} as ${optionType}`;
		});
		typeOptionGenerates.push(function*() {
			yield `{} as ${attrsType}`;
		});
	}
	if (ctx.generatedTypes.has(names.PublicProps)) {
		if (options.vueCompilerOptions.target < 3.6) {
			optionGenerates.push(function*() {
				let propsType = `${ctx.localTypes.TypePropsToOption}<${names.PublicProps}>`;
				if (scriptSetupRanges.withDefaults?.arg) {
					propsType = `${ctx.localTypes.WithDefaults}<${propsType}, typeof ${names.defaults}>`;
				}
				yield `{} as ${propsType}`;
			});
		}
		typeOptionGenerates.push(function*() {
			yield `{} as ${names.PublicProps}`;
		});
	}
	if (scriptSetupRanges.defineProps?.arg) {
		const { arg } = scriptSetupRanges.defineProps;
		optionGenerates.push(() => generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.navigation));
		typeOptionGenerates.length = 0;
	}

	const useTypeOption = options.vueCompilerOptions.target >= 3.5 && typeOptionGenerates.length;
	const useOption = (!useTypeOption || scriptSetupRanges.withDefaults) && optionGenerates.length;

	if (useTypeOption) {
		if (
			options.vueCompilerOptions.target >= 3.6
			&& scriptSetupRanges.withDefaults?.arg
		) {
			yield `__defaults: ${names.defaults},${newLine}`;
		}
		yield `__typeProps: `;
		yield* generateSpreadMerge(typeOptionGenerates.map(g => g()));
		yield `,${newLine}`;
	}
	if (useOption) {
		yield `props: `;
		yield* generateSpreadMerge(optionGenerates.map(g => g()));
		yield `,${newLine}`;
	}
}
