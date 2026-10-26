import {
	type IRStyle,
	scriptFeatures,
	type TemplateScope,
	type TypeScript,
	type VueCompilerOptions,
} from '@vue/language-core';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import type { TsCode } from '../tsCode';
import { endOfLine } from '../utils';
import { generateStyleModules } from './modules';
import { generateStyleScopedClasses } from './scopedClasses';

export interface StyleCodegenOptions {
	typescript: TypeScript;
	vueCompilerOptions: VueCompilerOptions;
	styles: readonly IRStyle[];
	scriptLang: string;
	setupRefs: Set<string>;
	setupConsts: Set<string>;
	setupBindings: Set<string>;
	dotValueBindings: Set<string>;
	templateScope: TemplateScope;
}

export { generate as generateStyle };

function generate(options: StyleCodegenOptions) {
	const ctx = createTemplateCodegenContext(options.scriptLang, options.templateScope);
	const codes: TsCode[] = [...generateWorker(options, ctx)];
	return { ...ctx, codes };
}

function* generateWorker(
	options: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
) {
	ctx.enterBlockScope(options.styles);
	yield* generateStyleScopedClasses(options, ctx);
	yield* generateStyleModules(options, ctx);
	yield* generateCssVars(options, ctx);
	yield* ctx.exitBlockScope();
}

function* generateCssVars(
	options: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<TsCode> {
	for (const style of options.styles) {
		for (const binding of style.bindings) {
			yield* generateInterpolation(
				options,
				ctx,
				style,
				{ features: scriptFeatures },
				binding.text,
				binding.offset,
				`(`,
				`)`,
			);
			yield endOfLine;
		}
	}
}
