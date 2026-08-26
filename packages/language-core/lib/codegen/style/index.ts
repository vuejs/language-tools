import type { Code, IRStyle, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { generateStyleModules } from '../style/modules';
import { generateStyleScopedClasses } from '../style/scopedClasses';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import { references as styleScopedClassReferences } from '../template/styleScopedClasses';
import { cutUnwrapPrefixBoundary, endOfLine } from '../utils';

export interface StyleCodegenOptions {
	typescript: typeof import('typescript');
	vueCompilerOptions: VueCompilerOptions;
	styles: readonly IRStyle[];
	destructuredProps: Set<string>;
	importedComponents: Set<string>;
	setupRefs: Set<string>;
	setupBindings: Set<string>;
	dotValueBindings: Set<string>;
}

export { generate as generateStyle };

function generate(options: StyleCodegenOptions) {
	// Codegen may run twice per file (dot-value collection pass + final pass);
	// the references registry accumulates as a side effect, so start clean.
	for (const style of options.styles) {
		styleScopedClassReferences.delete(style);
	}
	const ctx = createTemplateCodegenContext();
	const codeGenerator = generateWorker(options, ctx);
	const codes: Code[] = [];
	for (const code of codeGenerator) {
		if (typeof code === 'object') {
			code[3] = ctx.resolveCodeFeatures(code[3]);
		}
		codes.push(code);
	}
	cutUnwrapPrefixBoundary(codes);
	return { ...ctx, codes };
}

function* generateWorker(
	options: StyleCodegenOptions,
	ctx: TemplateCodegenContext,
) {
	const scope = ctx.scope();
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
