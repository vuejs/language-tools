import { getScriptLang } from '@vue/language-core';
import { computed } from 'alien-signals';
import type { BuiltinPluginFile, FilePlugin } from '../filePlugin';
import { names } from '../names';
import { asType, newLine, typeAliasRef } from '../writers';

/** The type of the root element of the template, which the component exposes as `$el`. */
export function createRootElPlugin({ ir, analysis, getTemplateVars }: BuiltinPluginFile): FilePlugin {
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
		name: 'vue:root-el',
		templateTypes: () => {
			const types = getRootElTypes();
			return types ? [{ name: names.RootEl, code: [...types].map(type => `${newLine}| ${type}`) }] : [];
		},
		templateDollars: () =>
			analysis.getTemplateScope().dollarVars.has('$el')
				? [[`{ $el: ${hasRootEl() ? typeAliasRef(names.RootEl, getScriptLang(ir)) : `any`} }`]]
				: [],
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
