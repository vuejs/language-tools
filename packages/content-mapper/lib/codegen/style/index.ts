import * as CompilerDOM from '@vue/compiler-dom';
import {
	completionFeatures,
	forEachElementNode,
	forEachPropStyleScopedClassReference,
	getScriptLang,
	type IR,
	type IRScriptSetup,
	type IRStyle,
	navigationFeatures,
	scriptFeatures,
	type ScriptSetupRanges,
	type TemplateScope,
	type TextRange,
	type TypeScript,
	type VueCompilerOptions,
} from '@vue/language-core';
import { computed } from 'alien-signals';
import type { BuiltinPluginFile, FilePlugin } from '../filePlugin';
import { names } from '../names';
import type { VueCodegenPiece, VueCodegenWriter } from '../plugin';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import type { TsCode } from '../tsCode';
import { asType, endOfLine, isTsLang, typeAliasRef } from '../writers';
import { generateStyleModuleImports, generateStyleModules } from './modules';
import { generateStyleScopedClasses } from './scopedClassNames';
import { generateStyleScopedClassReferences } from './scopedClassReferences';

export interface StyleCodegenOptions {
	typescript: TypeScript;
	ir: IR;
	vueCompilerOptions: VueCompilerOptions;
	styles: readonly IRStyle[];
	scriptLang: string;
	setupRefs: Set<string>;
	setupConsts: Set<string>;
	setupBindings: Set<string>;
	dotValueBindings: Set<string>;
	templateScope: TemplateScope;
}

/**
 * The style plugin: the types of the scoped classes and the CSS modules, the expressions of `v-bind()` in CSS, the
 * references of the template's class names to the scoped classes, and the types of `useCssModule()`.
 */
export function createStylePlugin({ ts, ir, analysis }: BuiltinPluginFile): FilePlugin {
	const getGeneratedStyle = computed(() => {
		if (!ir.styles.length) {
			return;
		}
		return generateStyle({
			typescript: ts,
			ir,
			vueCompilerOptions: analysis.getResolvedOptions(),
			styles: ir.styles,
			scriptLang: getScriptLang(ir),
			setupRefs: analysis.getSetupRefs(),
			setupConsts: analysis.getSetupConsts(),
			setupBindings: analysis.getSetupBindings(),
			dotValueBindings: analysis.getDotValueBindings(),
			templateScope: analysis.getTemplateScope(),
		});
	});
	const hasStyleModules = computed(() => !!getGeneratedStyle()?.generatedTypes.has(names.StyleModules));
	const getElementEnd = computed(() => {
		const elementEnd = new Map<CompilerDOM.ElementNode, TsCode[]>();
		if (ir.template?.ast) {
			const scriptLang = getScriptLang(ir);
			for (const node of forEachElementNode(ir.template.ast)) {
				const codes = [...generateStyleScopedClassReferences(ts, ir.template, scriptLang, node)];
				if (codes.length) {
					elementEnd.set(node, codes);
				}
			}
		}
		return elementEnd;
	});
	const getRenamedElsewhere = computed(() => {
		const renamedElsewhere = new Map<CompilerDOM.DirectiveNode, [number, number][]>();
		if (ir.template?.ast) {
			for (const node of forEachElementNode(ir.template.ast)) {
				for (const prop of node.props) {
					if (prop.type !== CompilerDOM.NodeTypes.DIRECTIVE) {
						continue;
					}
					// a class name renames through its reference to the style classes; the chars around it share its offsets
					const ranges = [...forEachPropStyleScopedClassReference(ts, ir.template, prop)]
						.map(([className, offset]): [number, number] => [offset - 1, offset + className.length + 1]);
					if (ranges.length) {
						renamedElsewhere.set(prop, ranges);
					}
				}
			}
		}
		return renamedElsewhere;
	});

	return {
		name: 'vue:style',
		templateTypes: () => [...getGeneratedStyle()?.generatedTypes ?? []],
		templateBody: () => getGeneratedStyle()?.codes ?? [],
		templateContext: () => hasStyleModules() ? [[typeAliasRef(names.StyleModules, getScriptLang(ir))]] : [],
		templateExports: () => hasStyleModules() ? [names.StyleModules] : [],
		declarations: () => [...generateStyleModuleImports(ir)],
		elementEnd: getElementEnd,
		renamedElsewhere: getRenamedElsewhere,
		rewrite({ scriptSetup }) {
			const scriptSetupRanges = analysis.getScriptSetupRanges();
			if (scriptSetup && scriptSetupRanges) {
				rewriteUseCssModule(
					scriptSetup,
					ir.scriptSetup!,
					scriptSetupRanges.useCssModule,
					getScriptLang(ir),
					hasStyleModules(),
				);
			}
		},
	};
}

function generateStyle(options: StyleCodegenOptions) {
	const ctx = createTemplateCodegenContext(options.scriptLang, options.templateScope, undefined);
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

/** Casts each `useCssModule()` call of `<script setup>` to the type of its CSS module. */
function rewriteUseCssModule(
	writer: VueCodegenWriter,
	scriptSetup: IRScriptSetup,
	calls: ScriptSetupRanges['useCssModule'],
	scriptLang: string,
	hasStyleModules: boolean,
) {
	const type = hasStyleModules ? typeAliasRef(names.StyleModules, scriptLang) : `{}`;
	for (const { callExp, exp, arg } of calls) {
		if (arg) {
			// the argument is copied as a reference into the cast, and is `any` at the call
			const name = writer.cut(arg.start, arg.end, {
				data: { features: navigationFeatures | completionFeatures },
				placeholder: asType('any', scriptLang),
			});
			if (isTsLang(scriptLang)) {
				writer.insertBefore(callExp.start, `(`);
				writer.insertAfter(callExp.end, [` as Omit<${type}, '$style'>[`, name, `])`]);
			}
			else {
				writer.insertBefore(callExp.start, [`/** @type {Omit<${type}, '$style'>[`, name, `]} */ (`]);
				writer.insertAfter(callExp.end, `)`);
			}
		}
		else {
			writer.insertBefore(callExp.start, isTsLang(scriptLang) ? `(` : `/** @type {${type}['$style']} */ (`);
			writer.insertAfter(
				callExp.end,
				isTsLang(scriptLang)
					? [` as ${type}[`, styleKey(scriptSetup, exp), `])`]
					: `)`,
			);
		}
	}
}

/** The key `'$style'`, which maps as a whole to the `useCssModule()` call without features. */
function styleKey(scriptSetup: IRScriptSetup, exp: TextRange): VueCodegenPiece {
	return { source: scriptSetup, start: exp.start, end: exp.end, data: { features: 0 }, text: `'$style'` };
}
