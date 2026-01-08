import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { generateStyleModules } from '../style/modules';
import { generateStyleScopedClasses } from '../style/scopedClasses';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import { endOfLine } from '../utils';

export interface StyleCodegenOptions {
	typescript: typeof import('typescript');
	vueCompilerOptions: VueCompilerOptions;
	styles: Sfc['styles'];
	setupRefs: Set<string>;
	setupConsts: Set<string>;
}

export { generate as generateStyle };

function generate(options: StyleCodegenOptions) {
	const ctx = createTemplateCodegenContext();
	const codeGenerator = generateWorker(options, ctx);
	const codes: Code[] = [];
	for (const code of codeGenerator) {
		if (typeof code === 'object') {
			code[3] = ctx.resolveCodeFeatures(code[3]);
		}
		codes.push(code);
	}
	return { ...ctx, codes };
}

function* generateWorker(
	options: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
) {
	const endScope = ctx.startScope();
	ctx.declare(...options.setupConsts);
	yield* generateStyleScopedClasses(options);
	yield* generateStyleModules(options, ctx);
	yield* generateCssVars(options, ctx);
	yield* endScope();
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
				codeFeatures.all,
				binding.text,
				binding.offset,
				`(`,
				`)`,
			);
			yield endOfLine;
		}
	}
}
