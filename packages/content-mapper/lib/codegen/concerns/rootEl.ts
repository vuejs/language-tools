import { getScriptLang } from '@vue/language-core';
import { computed } from 'alien-signals';
import type { CodegenConcern, CodegenConcernFile } from '../concern';
import { names } from '../names';
import { asType, generateTypeAlias, newLine, typeAliasRef } from '../writers';

/** The type of the root element of the template, which the component exposes as `$el`. */
export function createRootElConcern({ ir, analysis, getTemplateVars }: CodegenConcernFile): CodegenConcern {
	/** The types of the root elements of a template with a single root element in each branch. */
	const getRootElTypes = computed(() => {
		const { rootElements, singleRootNodes, dollarVars } = analysis.getTemplateScope();
		const vars = getTemplateVars();
		if (
			!vars
			|| singleRootNodes.has(null)
			|| !(dollarVars.has('$el') || analysis.getResolvedOptions().inferComponentDollarEl)
		) {
			return;
		}
		const types = new Set<string>();
		for (const node of rootElements) {
			const instance = vars.componentInstanceVars.get(node);
			types.add(instance ? `NonNullable<typeof ${instance.instanceVar}>['$el']` : `${names.Elements}['${node.tag}']`);
		}
		return types.size ? types : undefined;
	});
	const hasRootEl = () => !!getRootElTypes();
	return {
		templateTypes: () => hasRootEl() ? [names.RootEl] : [],
		templateEnd: () => {
			const types = getRootElTypes();
			return types
				? [...generateTypeAlias(names.RootEl, getScriptLang(ir), function*() {
					for (const type of types) {
						yield `${newLine}| ${type}`;
					}
				})]
				: [];
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
