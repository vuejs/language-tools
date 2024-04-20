import { generateSfcBlockSection, generateSfcBlockSectionForExtraReference } from './index';
import type { ScriptRanges } from '../../parsers/scriptRanges';
import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc } from '../../types';
import { newLine } from '../common';
import type { ScriptCodegenContext } from './context';

export function* generateComponentOptionsByScript(
	script: NonNullable<Sfc['script']>,
	scriptRanges: ScriptRanges,
): Generator<Code> {
	if (scriptRanges.exportDefault?.args) {
		yield generateSfcBlockSection(script, scriptRanges.exportDefault.args.start + 1, scriptRanges.exportDefault.args.end - 1);
	}
}

export function* generateComponentOptionsByScriptSetup(
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	functional: boolean,
): Generator<Code> {
	const propsCodegens: (() => Generator<Code>)[] = [];

	if (scriptSetupRanges.props.define?.arg) {
		const { arg } = scriptSetupRanges.props.define;
		propsCodegens.push(function* () {
			yield generateSfcBlockSectionForExtraReference(scriptSetup, arg.start, arg.end);
		});
	}
	if (scriptSetupRanges.props.define?.typeArg) {
		const { typeArg } = scriptSetupRanges.props.define;
		propsCodegens.push(function* () {
			yield `{} as `;
			if (scriptSetupRanges.props.withDefaults?.arg) {
				yield `${ctx.helperTypes.WithDefaults.name}<`;
			}
			yield `${ctx.helperTypes.TypePropsToOption.name}<`;
			if (functional) {
				yield `typeof __VLS_fnPropsTypeOnly`;
			}
			else {
				yield generateSfcBlockSectionForExtraReference(scriptSetup, typeArg.start, typeArg.end);
			}
			yield `>`;
			if (scriptSetupRanges.props.withDefaults?.arg) {
				yield `, typeof __VLS_withDefaultsArg>`;
			}
		});
	}
	if (!functional && scriptSetupRanges.defineProp.length) {
		propsCodegens.push(function* () {
			yield `__VLS_propsOption_defineProp`;
		});
	}

	if (propsCodegens.length === 1) {
		yield `props: `;
		for (const generate of propsCodegens) {
			yield* generate();
		}
		yield `,${newLine}`;
	}
	else if (propsCodegens.length >= 2) {
		yield `props: {${newLine}`;
		for (const generate of propsCodegens) {
			yield `...`;
			yield* generate();
			yield `,${newLine}`;
		}
		yield `},${newLine}`;
	}
	if (scriptSetupRanges.defineProp.filter(p => p.isModel).length || scriptSetupRanges.emits.define) {
		yield `emits: ({} as __VLS_NormalizeEmits<typeof __VLS_modelEmitsType`;
		if (scriptSetupRanges.emits.define) {
			yield ` & typeof `;
			yield scriptSetupRanges.emits.name ?? '__VLS_emit';
		}
		yield `>),${newLine}`;
	}
}
