import type { ScriptSetupRanges } from '../../parsers/scriptSetupRanges';
import type { Code, Sfc } from '../../types';
import { endOfLine, newLine } from '../common';
import { generateComponentOptionsByScript, generateComponentOptionsByScriptSetup } from './componentOptions';
import type { ScriptCodegenContext } from './context';
import { ScriptCodegenOptions, generateSfcBlockSection } from './index';
import { generateComponentSetupReturns } from './componentSetupReturns';

export function* generateComponent(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	scriptSetup: NonNullable<Sfc['scriptSetup']>,
	scriptSetupRanges: ScriptSetupRanges,
	functional: boolean,
): Generator<Code> {
	if (options.sfc.script && options.scriptRanges?.exportDefault && options.scriptRanges.exportDefault.expression.start !== options.scriptRanges.exportDefault.args.start) {
		// use defineComponent() from user space code if it exist
		yield generateSfcBlockSection(options.sfc.script, options.scriptRanges.exportDefault.expression.start, options.scriptRanges.exportDefault.args.start);
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
		yield* generateComponentOptionsByScriptSetup(ctx, scriptSetup, scriptSetupRanges, functional);
	}
	if (options.sfc.script && options.scriptRanges) {
		yield* generateComponentOptionsByScript(options.sfc.script, options.scriptRanges);
	}
	yield `})`;
}
