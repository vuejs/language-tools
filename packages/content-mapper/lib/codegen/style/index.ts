import * as CompilerDOM from '@vue/compiler-dom';
import {
	type CodeSource,
	completionFeatures,
	forEachElementNode,
	forEachPropStyleScopedClassReference,
	getScriptLang,
	type IRScriptSetup,
	type IRStyle,
	navigationFeatures,
	scriptFeatures,
	type TemplateScope,
	type TypeScript,
	type VueCompilerOptions,
} from '@vue/language-core';
import { computed } from 'alien-signals';
import type { CoreRewriteWriter } from 'muggle-string';
import type { CodegenConcern, CodegenConcernFile } from '../concern';
import { names } from '../names';
import type { TsCodeData } from '../piece';
import { createTemplateCodegenContext, type TemplateCodegenContext } from '../template/context';
import { generateInterpolation } from '../template/interpolation';
import { Boundary, type TsCode } from '../tsCode';
import { asType, endOfLine, isTsLang, typeAliasRef } from '../writers';
import { generateStyleModuleImports, generateStyleModules } from './modules';
import { generateStyleScopedClasses } from './scopedClassNames';
import { generateStyleScopedClassReferences } from './scopedClassReferences';

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

/**
 * The style concern: the types of the scoped classes and the CSS modules, the expressions of `v-bind()` in CSS, the
 * references of the template's class names to the scoped classes, and the types of `useCssModule()`.
 */
export function createStyleConcern({ ts, ir, analysis }: CodegenConcernFile): CodegenConcern {
	const getGeneratedStyle = computed(() => {
		if (!ir.styles.length) {
			return;
		}
		return generateStyle({
			typescript: ts,
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
		templateTypes: () => [...getGeneratedStyle()?.generatedTypes ?? []],
		templateBody: () => getGeneratedStyle()?.codes ?? [],
		templateContext: () =>
			hasStyleModules()
				? [asType(typeAliasRef(names.StyleModules, getScriptLang(ir)), getScriptLang(ir))]
				: [],
		templateExports: () => hasStyleModules() ? [names.StyleModules] : [],
		moduleEnd: () => [...generateStyleModuleImports(ir.styles)],
		elementEnd: getElementEnd,
		renamedElsewhere: getRenamedElsewhere,
		rewriteScriptSetup(core, scriptSetup) {
			const scriptSetupRanges = analysis.getScriptSetupRanges();
			if (scriptSetupRanges) {
				rewriteUseCssModule(core, scriptSetup, scriptSetupRanges.useCssModule, getScriptLang(ir), hasStyleModules());
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
	core: CoreRewriteWriter<CodeSource, TsCodeData>,
	scriptSetup: IRScriptSetup,
	calls: NonNullable<ReturnType<CodegenConcernFile['analysis']['getScriptSetupRanges']>>['useCssModule'],
	scriptLang: string,
	hasStyleModules: boolean,
) {
	const type = hasStyleModules ? typeAliasRef(names.StyleModules, scriptLang) : `{}`;
	for (const { callExp, exp, arg } of calls) {
		if (arg) {
			// the argument is copied as a reference into the cast, and is `any` at the call
			const name = core.cut(arg.start, arg.end, {
				data: { features: navigationFeatures | completionFeatures },
				placeholder: asType('any', scriptLang),
			});
			if (isTsLang(scriptLang)) {
				core.insertBefore(callExp.start, `(`);
				core.insertAfter(callExp.end, () => [` as Omit<${type}, '$style'>[`, name, `])`]);
			}
			else {
				core.insertBefore(callExp.start, () => [`/** @type {Omit<${type}, '$style'>[`, name, `]} */ (`]);
				core.insertAfter(callExp.end, `)`);
			}
		}
		else {
			core.insertBefore(callExp.start, isTsLang(scriptLang) ? `(` : `/** @type {${type}['$style']} */ (`);
			core.insertAfter(callExp.end, function*() {
				if (isTsLang(scriptLang)) {
					yield ` as ${type}[`;
					const boundary = yield* Boundary.start(scriptSetup, exp.start, exp.end, { features: 0 });
					yield `'$style'`;
					yield boundary.end();
					yield `])`;
				}
				else {
					yield `)`;
				}
			});
		}
	}
}
