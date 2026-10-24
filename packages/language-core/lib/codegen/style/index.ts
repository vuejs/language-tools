import type { Code, IRStyle, TypeScript, VueCompilerOptions } from '../../types';
import { scriptFeatures } from '../features';
import { generateStyleModules } from '../style/modules';
import { generateStyleScopedClasses } from '../style/scopedClasses';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import { references as styleScopedClassReferences } from '../template/styleScopedClasses';
import { endOfLine } from '../utils';

export interface StyleCodegenOptions {
	typescript: TypeScript;
	vueCompilerOptions: VueCompilerOptions;
	styles: readonly IRStyle[];
	scriptLang: string;
	setupRefs: Set<string>;
	setupConsts: Set<string>;
	setupBindings: Set<string>;
	dotValueBindings: Set<string>;
}

export { generate as generateStyle };

function generate(options: StyleCodegenOptions) {
	// The references registry accumulates across codegen passes; start clean.
	for (const style of options.styles) {
		styleScopedClassReferences.delete(style);
	}
	const ctx = createTemplateCodegenContext(options.scriptLang);
	const codes: Code[] = [...generateWorker(options, ctx)];
	return { ...ctx, codes };
}

function* generateWorker(
	options: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
) {
	const scope = ctx.scope(true);
	yield* generateStyleScopedClasses(options, ctx);
	yield* generateStyleModules(options, ctx);
	yield* generateCssVars(options, ctx);
	yield* scope.end();
}

function* generateCssVars(
	options: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
): Generator<Code> {
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
