import * as path from 'path-browserify';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { generateComponentSetupReturns, generateEmitsOption, generatePropsOption } from './component';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';
import { getTemplateUsageVars } from './template';

export function* generateComponentSelf(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	templateCodegenCtx: TemplateCodegenContext
): Generator<Code> {
	if (options.sfc.scriptSetup && options.scriptSetupRanges) {
		yield `const __VLS_self = (await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;
		yield `setup() {${newLine}`;
		yield `return {${newLine}`;
		if (ctx.bypassDefineComponent) {
			yield* generateComponentSetupReturns(options.scriptSetupRanges);
		}
		// bindings
		const templateUsageVars = getTemplateUsageVars(options, ctx);
		for (const [content, bindings] of [
			[options.sfc.scriptSetup.content, options.scriptSetupRanges.bindings] as const,
			options.sfc.script && options.scriptRanges
				? [options.sfc.script.content, options.scriptRanges.bindings] as const
				: ['', []] as const,
		]) {
			for (const { range } of bindings) {
				const varName = content.slice(range.start, range.end);
				if (!templateUsageVars.has(varName) && !templateCodegenCtx.accessExternalVariables.has(varName)) {
					continue;
				}
				const templateOffset = options.getGeneratedLength();
				yield `${varName}: ${varName} as typeof `;

				const scriptOffset = options.getGeneratedLength();
				yield `${varName},${newLine}`;

				options.linkedCodeMappings.push({
					sourceOffsets: [scriptOffset],
					generatedOffsets: [templateOffset],
					lengths: [varName.length],
					data: undefined,
				});
			}
		}
		yield `}${endOfLine}`; // return {
		yield `},${newLine}`; // setup() {
		if (options.sfc.scriptSetup && options.scriptSetupRanges && !ctx.bypassDefineComponent) {
			const emitOptionCodes = [...generateEmitsOption(options, options.scriptSetupRanges)];
			for (const code of emitOptionCodes) {
				yield code;
			}
			yield* generatePropsOption(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges, !!emitOptionCodes.length, false);
		}
		if (options.sfc.script && options.scriptRanges?.exportDefault?.args) {
			const { args } = options.scriptRanges.exportDefault;
			yield generateSfcBlockSection(options.sfc.script, args.start + 1, args.end - 1, codeFeatures.all);
		}
		yield `})${endOfLine}`; // defineComponent {
	}
	else if (options.sfc.script) {
		yield `let __VLS_self!: typeof import('./${path.basename(options.fileName)}').default${endOfLine}`;
	}
	else {
		yield `const __VLS_self = (await import('${options.vueCompilerOptions.lib}')).defineComponent({})${endOfLine}`;
	}
}
