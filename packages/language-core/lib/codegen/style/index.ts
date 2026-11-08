import type { Code, IRStyle, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { generateStyleModules } from '../style/modules';
import { generateStyleScopedClasses } from '../style/scopedClasses';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import { references as styleScopedClassReferences } from '../template/styleScopedClasses';
import { endOfLine } from '../utils';

export interface StyleCodegenOptions {
	typescript: typeof import('typescript');
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
	const ctx = createTemplateCodegenContext();
	const resolve = (codeGenerator: Iterable<Code>) => {
		const codes: Code[] = [];
		for (const code of codeGenerator) {
			if (typeof code === 'object') {
				code[3] = ctx.resolveCodeFeatures(code[3]);
			}
			codes.push(code);
		}
		return codes;
	};
	// The CSS modules type depends on nothing in the template, so it is kept apart
	// and declared outside the template function (see codegen/script/template.ts).
	const styleModulesCodes = resolve(generateStyleModules(options, ctx));
	const codes = resolve(generateWorker(options, ctx));
	return { ...ctx, codes, styleModulesCodes };
}

function* generateWorker(
	options: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
) {
	const scope = ctx.scope();
	yield* generateStyleScopedClasses(options, ctx);
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
