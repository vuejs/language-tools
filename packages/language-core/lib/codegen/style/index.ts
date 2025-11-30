import type { Code, Sfc, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { generateStyleModules } from '../style/modules';
import { generateStyleScopedClasses } from '../style/scopedClasses';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import { endOfLine } from '../utils';

export interface StyleCodegenOptions {
	ts: typeof import('typescript');
	vueCompilerOptions: VueCompilerOptions;
	usedCssModule: boolean;
	styles: Sfc['styles'];
	destructuredPropNames: Set<string>;
	templateRefNames: Set<string>;
}

export { generate as generateStyle };

function* generate(options: StyleCodegenOptions) {
	const ctx = createTemplateCodegenContext({
		scriptSetupBindingNames: new Set(),
	});
	yield* generateStyleScopedClasses(options);
	yield* generateStyleModules(options, ctx);
	yield* generateCssVars(options, ctx);
	return ctx;
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
