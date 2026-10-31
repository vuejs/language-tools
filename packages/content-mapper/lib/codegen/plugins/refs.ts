import { completionFeatures, getScriptLang, navigationFeatures, type ScriptSetupRanges } from '@vue/language-core';
import { computed } from 'alien-signals';
import type { BuiltinPluginFile, FilePlugin } from '../filePlugin';
import { names } from '../names';
import type { VueCodegenWriter } from '../plugin';
import { Boundary, synthesizedIgnore, type TsCode } from '../tsCode';
import { asType, isTsLang, newLine, typeAliasRef } from '../writers';
import { generatePropertyKey } from '../writers/stringLiteralKey';

/**
 * The types of the template refs: their type at the end of the template, which the component exposes as `$refs`, and
 * the types of `useTemplateRef()`.
 */
export function createRefsPlugin({ ir, analysis, getTemplateVars }: BuiltinPluginFile): FilePlugin {
	const getTemplateRefs = computed(() => {
		const { templateRefs } = analysis.getTemplateScope();
		const { inferTemplateDollarRefs, inferComponentDollarRefs } = analysis.getResolvedOptions();
		const vars = getTemplateVars();
		if (
			vars
			&& templateRefs.size
			&& (inferTemplateDollarRefs || inferComponentDollarRefs || analysis.getSetupRefs().size)
		) {
			return { templateRefs, vars };
		}
	});
	const hasTemplateRefs = () => !!getTemplateRefs();
	return {
		name: 'vue:refs',
		templateTypes: () => {
			const refs = getTemplateRefs();
			if (!refs) {
				return [];
			}
			const template = ir.template!;
			const { templateRefs, vars } = refs;
			return [{
				name: names.TemplateRefs,
				code: [...(function*(): Generator<TsCode> {
					yield `{}`;
					for (const [name, refs] of templateRefs) {
						yield `${newLine}& `;
						if (refs.length >= 2) {
							yield `(`;
						}
						for (let i = 0; i < refs.length; i++) {
							const { node, offset, inVFor } = refs[i]!;
							const instance = vars.componentInstanceVars.get(node);
							let typeExp = instance
								? `typeof ${instance.hoistedVar} | null`
								: `${names.Elements}['${node.tag}']`;
							if (inVFor) {
								typeExp = instance ? `(${typeExp})[]` : `${typeExp}[]`;
							}
							if (i) {
								yield ` | `;
							}
							yield `{ `;
							const ignore = yield* Boundary.start(template, 0, 0, synthesizedIgnore);
							yield* generatePropertyKey(name, template, offset, { features: navigationFeatures });
							yield ignore.end();
							yield `: ${typeExp} }`;
						}
						if (refs.length >= 2) {
							yield `)`;
						}
					}
				})()],
			}];
		},
		templateDollars: () =>
			analysis.getTemplateScope().dollarVars.has('$refs')
				? [[`{ $refs: ${hasTemplateRefs() ? typeAliasRef(names.TemplateRefs, getScriptLang(ir)) : `{}`} }`]]
				: [],
		componentOptions: () => {
			const { target, inferComponentDollarRefs } = analysis.getResolvedOptions();
			const scriptLang = getScriptLang(ir);
			return target >= 3.5 && inferComponentDollarRefs && hasTemplateRefs()
				? [`__typeRefs: ${asType(typeAliasRef(names.TemplateRefs, scriptLang), scriptLang)}`]
				: [];
		},
		exposedInstanceTypes: () =>
			analysis.getResolvedOptions().inferComponentDollarRefs && hasTemplateRefs()
				? [`{ $refs: ${typeAliasRef(names.TemplateRefs, getScriptLang(ir))}; }`]
				: [],
		rewrite({ scriptSetup }) {
			const scriptSetupRanges = analysis.getScriptSetupRanges();
			if (scriptSetup && scriptSetupRanges) {
				rewriteUseTemplateRef(scriptSetup, scriptSetupRanges, getScriptLang(ir), analysis.getResolvedOptions().lib);
			}
		},
	};
}

/** Casts each `useTemplateRef()` call of `<script setup>` to a ref of the type of its template ref. */
function rewriteUseTemplateRef(
	writer: VueCodegenWriter,
	scriptSetupRanges: ScriptSetupRanges,
	scriptLang: string,
	lib: string,
) {
	for (const { callExp, arg } of scriptSetupRanges.useTemplateRef) {
		// the argument is copied as a reference into the cast, and is `any` at the call
		const name = arg && writer.cut(arg.start, arg.end, {
			data: { features: navigationFeatures | completionFeatures },
			placeholder: asType('any', scriptLang),
		});
		const refType = name
			? [typeAliasRef(names.TemplateRefs, scriptLang), `[`, name, `]`]
			: [`unknown`];
		const shallowRef = `Readonly<import('${lib}').ShallowRef<`;
		if (isTsLang(scriptLang)) {
			writer.insertBefore(callExp.start, `(`);
			writer.insertAfter(callExp.end, [` as ${shallowRef}`, ...refType, ` | null>>)`]);
		}
		else {
			writer.insertBefore(callExp.start, [`/** @type {${shallowRef}`, ...refType, ` | null>>} */ (`]);
			writer.insertAfter(callExp.end, `)`);
		}
	}
}
