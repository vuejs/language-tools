import { camelize, capitalize } from '@vue/shared';
import * as path from 'path-browserify';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import type { TemplateCodegenContext } from '../template/context';
import { endOfLine, generateSfcBlockSection, newLine } from '../utils';
import { generateComponentSetupReturns, generateEmitsOption, generatePropsOption } from './component';
import type { ScriptCodegenContext } from './context';
import type { ScriptCodegenOptions } from './index';

export function* generateComponentSelf(
	options: ScriptCodegenOptions,
	ctx: ScriptCodegenContext,
	templateCodegenCtx: TemplateCodegenContext,
): Generator<Code> {
	if (options.sfc.scriptSetup && options.scriptSetupRanges) {
		yield `const __VLS_self = (await import('${options.vueCompilerOptions.lib}')).defineComponent({${newLine}`;
		yield `setup: () => ({${newLine}`;
		if (ctx.bypassDefineComponent) {
			for (const code of generateComponentSetupReturns(options.scriptSetupRanges)) {
				yield `...${code},${newLine}`;
			}
		}
		// bindings
		const templateUsageVars = new Set([
			...options.sfc.template?.ast?.components.flatMap(c => [camelize(c), capitalize(camelize(c))]) ?? [],
			...options.templateCodegen?.accessExternalVariables.keys() ?? [],
			...templateCodegenCtx.accessExternalVariables.keys(),
		]);
		for (const varName of ctx.bindingNames) {
			if (!templateUsageVars.has(varName)) {
				continue;
			}
			const token = Symbol(varName.length);
			yield ['', undefined, 0, { __linkedToken: token }];
			yield `${varName}: ${varName} as typeof `;
			yield ['', undefined, 0, { __linkedToken: token }];
			yield `${varName},${newLine}`;
		}
		yield `}),${newLine}`;
		if (!ctx.bypassDefineComponent) {
			const emitOptionCodes = [...generateEmitsOption(options, options.scriptSetupRanges)];
			yield* emitOptionCodes;
			yield* generatePropsOption(
				options,
				ctx,
				options.sfc.scriptSetup,
				options.scriptSetupRanges,
				!!emitOptionCodes.length,
				false,
			);
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
