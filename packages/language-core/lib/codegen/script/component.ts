import type { ScriptRanges } from '../../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc } from '../../types';
import { endOfLine, generateSfcBlockSection, newLine } from '../common';
import type { ScriptCodegenContext } from './context';
import { ScriptCodegenOptions, codeFeatures } from './index';

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
	if (scriptSetupRanges.expose.define) {
		yield `...__VLS_exposed,${newLine}`;
	}
	yield `}${endOfLine}`;
	yield `},${newLine}`;
	if (!ctx.bypassDefineComponent) {
		yield* generateScriptSetupOptions(options, ctx, scriptSetup, scriptSetupRanges);
	}
	if (options.sfc.script && options.scriptRanges) {
		yield* generateScriptOptions(options.sfc.script, options.scriptRanges);
	}
	yield `})`;
}

export function* generateComponentSetupReturns(scriptSetupRanges: ScriptSetupRanges): Generator<Code> {
	// fill $props
	if (scriptSetupRanges.props.define) {
		// NOTE: defineProps is inaccurate for $props
		yield `$props: __VLS_makeOptional(${scriptSetupRanges.props.name ?? `__VLS_props`}),${newLine}`;
		yield `...${scriptSetupRanges.props.name ?? `__VLS_props`},${newLine}`;
	}
	// fill $emit
	if (scriptSetupRanges.emits.define) {
		yield `$emit: ${scriptSetupRanges.emits.name ?? '__VLS_emit'},${newLine}`;
	}
}

export function* generateScriptOptions(
	script: NonNullable<Sfc['script']>,
	scriptRanges: ScriptRanges
): Generator<Code> {
	if (scriptRanges.exportDefault?.args) {
		yield generateSfcBlockSection(script, scriptRanges.exportDefault.args.start + 1, scriptRanges.exportDefault.args.end - 1, codeFeatures.all);
	}
}

export function* generateScriptSetupOptions(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	const propsCodegens: (() => Generator<Code>)[] = [];
	const propsName = options.vueCompilerOptions.target < 3.5 || scriptSetupRanges.props.define?.arg || scriptSetupRanges.props.withDefaults
		? 'props' : '__typeProps';

	if (ctx.generatedPropsType) {
		propsCodegens.push(function* () {
			yield `{} as `;
			if (propsName === 'props') {
				if (scriptSetupRanges.props.withDefaults?.arg) {
					yield `${ctx.helperTypes.WithDefaults.name}<`;
				}
				yield `${ctx.helperTypes.TypePropsToOption.name}<`;
				yield `__VLS_PublicProps>`;
				if (scriptSetupRanges.props.withDefaults?.arg) {
					yield `, typeof __VLS_withDefaultsArg>`;
				}
			} else {
				yield `__VLS_PublicProps`;
			}
		});
	}
	if (scriptSetupRanges.props.define?.arg) {
		const { arg } = scriptSetupRanges.props.define;
		propsCodegens.push(function* () {
			yield generateSfcBlockSection(scriptSetup, arg.start, arg.end, codeFeatures.navigation);
		});
	}

	if (propsCodegens.length === 1) {
		yield `${propsName}: `;
		for (const generate of propsCodegens) {
			yield* generate();
		}
		yield `,${newLine}`;
	}
	else if (propsCodegens.length >= 2) {
		yield `${propsName}: {${newLine}`;
		for (const generate of propsCodegens) {
			yield `...`;
			yield* generate();
			yield `,${newLine}`;
		}
		yield `},${newLine}`;
	}

	yield* generateEmitsOption(options, scriptSetup, scriptSetupRanges);
}

export function* generateEmitsOption(
	options: ScriptCodegenOptions,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges
): Generator<Code> {
	if (scriptSetupRanges.emits.define || scriptSetupRanges.defineProp.some(p => p.isModel)) {
		if (options.vueCompilerOptions.target < 3.5 || scriptSetupRanges.emits.define?.arg || scriptSetupRanges.emits.define?.hasUnionTypeArg) {
			yield `emits: ({} as __VLS_NormalizeEmits<__VLS_ModelEmitsType`;
			if (scriptSetupRanges?.emits.define) {
				yield ` & typeof `;
				yield scriptSetupRanges.emits.name ?? '__VLS_emit';
			}
			yield `>),${newLine}`;
		} else {
			yield `__typeEmits: {} as __VLS_ModelEmitsType`;
			const typeArg = scriptSetupRanges.emits.define?.typeArg;
			if (typeArg) {
				yield ` & `;
				yield scriptSetup.content.slice(typeArg.start, typeArg.end);
			}
			yield `,${newLine}`;
		}
	}
}