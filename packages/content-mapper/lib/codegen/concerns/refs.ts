import { completionFeatures, getScriptLang, navigationFeatures, type ScriptSetupRanges } from '@vue/language-core';
import type { CodegenConcern, CodegenConcernFile } from '../concern';
import { names } from '../names';
import type { BlockWriter } from '../rewrite/blockRewrite';
import type { TemplateCode } from '../template';
import { Boundary, synthesizedIgnore } from '../tsCode';
import { asType, generateTypeAlias, isTsLang, newLine, typeAliasRef } from '../writers';

/**
 * The types of the template refs: their type at the end of the template, which the component exposes as `$refs`, and
 * the types of `useTemplateRef()`.
 */
export function createRefsConcern({ ir, analysis, getTemplateTypes }: CodegenConcernFile): CodegenConcern {
	const hasTemplateRefs = () => getTemplateTypes().has(names.TemplateRefs);
	return {
		generateTemplateEnd({ templateRefs }) {
			const { inferTemplateDollarRefs, inferComponentDollarRefs } = analysis.getResolvedOptions();
			if (
				!ir.template
				|| !templateRefs.size
				|| !(inferTemplateDollarRefs || inferComponentDollarRefs || analysis.getSetupRefs().size)
			) {
				return;
			}
			const template = ir.template;
			return {
				types: [names.TemplateRefs],
				codes: [...generateTypeAlias(names.TemplateRefs, getScriptLang(ir), function*(): Generator<TemplateCode> {
					yield `{}`;
					for (const [name, refs] of templateRefs) {
						yield `${newLine}& `;
						if (refs.length >= 2) {
							yield `(`;
						}
						for (let i = 0; i < refs.length; i++) {
							const { typeExp, offset } = refs[i]!;
							if (i) {
								yield ` | `;
							}
							yield `{ `;
							const ignore = yield* Boundary.start(template, 0, 0, synthesizedIgnore);
							yield { key: name, offset, features: { features: navigationFeatures } };
							yield ignore.end();
							yield `: ${typeExp} }`;
						}
						if (refs.length >= 2) {
							yield `)`;
						}
					}
				})],
			};
		},
		templateExports: () => hasTemplateRefs() ? [names.TemplateRefs] : [],
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
		rewriteScriptSetup(core) {
			const scriptSetupRanges = analysis.getScriptSetupRanges();
			if (scriptSetupRanges) {
				rewriteUseTemplateRef(core, scriptSetupRanges, getScriptLang(ir), analysis.getResolvedOptions().lib);
			}
		},
	};
}

/** Casts each `useTemplateRef()` call of `<script setup>` to a ref of the type of its template ref. */
function rewriteUseTemplateRef(
	core: BlockWriter,
	scriptSetupRanges: ScriptSetupRanges,
	scriptLang: string,
	lib: string,
) {
	for (const { callExp, arg } of scriptSetupRanges.useTemplateRef) {
		// the argument is copied as a reference into the cast, and is `any` at the call
		const name = arg && core.cut(arg.start, arg.end, {
			data: { features: navigationFeatures | completionFeatures },
			placeholder: asType('any', scriptLang),
		});
		const refType = name
			? [typeAliasRef(names.TemplateRefs, scriptLang), `[`, name, `]`]
			: [`unknown`];
		const shallowRef = `Readonly<import('${lib}').ShallowRef<`;
		if (isTsLang(scriptLang)) {
			core.insertBefore(callExp.start, `(`);
			core.insertAfter(callExp.end, [` as ${shallowRef}`, ...refType, ` | null>>)`]);
		}
		else {
			core.insertBefore(callExp.start, [`/** @type {${shallowRef}`, ...refType, ` | null>>} */ (`]);
			core.insertAfter(callExp.end, `)`);
		}
	}
}
