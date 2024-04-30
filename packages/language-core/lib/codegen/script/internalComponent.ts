import type { Code } from '../../types';
import { endOfLine, newLine } from '../common';
import type { TemplateCodegenContext } from '../template/context';
import { generateComponentSetupReturns, generateScriptOptions, generateScriptSetupOptions } from './component';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';
import { getTemplateUsageVars } from './template';

export function* generateInternalComponent(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	templateCodegenCtx: TemplateCodegenContext,
): Generator<Code> {
	if (options.sfc.scriptSetup && options.scriptSetupRanges) {
		yield `const __VLS_internalComponent = (await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;
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
			for (const expose of bindings) {
				const varName = content.substring(expose.start, expose.end);
				if (!templateUsageVars.has(varName) && !templateCodegenCtx.accessGlobalVariables.has(varName)) {
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
			yield* generateScriptSetupOptions(options, ctx, options.sfc.scriptSetup, options.scriptSetupRanges);
		}
		if (options.sfc.script && options.scriptRanges) {
			yield* generateScriptOptions(options.sfc.script, options.scriptRanges);
		}
		yield `})${endOfLine}`; // defineComponent {
	}
	else if (options.sfc.script) {
		yield `const __VLS_internalComponent = (await import('./${options.fileBaseName}')).default${endOfLine}`;
	}
	else {
		yield `const __VLS_internalComponent = (await import('${options.vueCompilerOptions.lib}')).defineComponent({})${endOfLine}`;
	}
}
