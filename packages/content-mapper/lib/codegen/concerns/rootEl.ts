import { getScriptLang } from '@vue/language-core';
import type { CodegenConcern, CodegenConcernFile } from '../concern';
import { names } from '../names';
import { asType, generateTypeAlias, newLine, typeAliasRef } from '../writers';

/** The type of the root element of the template, which the component exposes as `$el`. */
export function createRootElConcern({ ir, analysis, getTemplateTypes }: CodegenConcernFile): CodegenConcern {
	const hasRootEl = () => getTemplateTypes().has(names.RootEl);
	return {
		generateTemplateEnd({ singleRootElTypes, hasNonElementRoot }) {
			if (!singleRootElTypes.size || hasNonElementRoot) {
				return;
			}
			return {
				types: [names.RootEl],
				codes: [...generateTypeAlias(names.RootEl, getScriptLang(ir), function*() {
					for (const type of singleRootElTypes) {
						yield `${newLine}| ${type}`;
					}
				})],
			};
		},
		templateExports: () => hasRootEl() ? [names.RootEl] : [],
		componentOptions: () => {
			const { target, inferComponentDollarEl } = analysis.getResolvedOptions();
			const scriptLang = getScriptLang(ir);
			return target >= 3.5 && inferComponentDollarEl && hasRootEl()
				? [`__typeEl: ${asType(typeAliasRef(names.RootEl, scriptLang), scriptLang)}`]
				: [];
		},
		exposedInstanceTypes: () =>
			analysis.getResolvedOptions().inferComponentDollarEl && hasRootEl()
				? [`{ $el: ${typeAliasRef(names.RootEl, getScriptLang(ir))}; }`]
				: [],
	};
}
