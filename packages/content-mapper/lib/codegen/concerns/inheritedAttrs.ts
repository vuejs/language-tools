import { getScriptLang } from '@vue/language-core';
import type { CodegenConcern, CodegenConcernFile } from '../concern';
import { names } from '../names';
import { generateTypeAlias, typeAliasRef } from '../writers';

/** The type of the attributes that fall through to the root of the template, which the component takes as props. */
export function createInheritedAttrsConcern({ ir, analysis, getTemplateVars }: CodegenConcernFile): CodegenConcern {
	const hasInheritedAttrs = () => !!getTemplateVars()?.inheritedAttrVars.size;
	return {
		templateTypes: () => hasInheritedAttrs() ? [names.InheritedAttrs] : [],
		templateEnd: () => {
			if (!hasInheritedAttrs()) {
				return [];
			}
			const type = [...getTemplateVars()!.inheritedAttrVars].map(name => `typeof ${name}`).join(` & `);
			const { checkRequiredFallthroughAttributes } = analysis.getResolvedOptions();
			return [...generateTypeAlias(names.InheritedAttrs, getScriptLang(ir), function*() {
				yield checkRequiredFallthroughAttributes ? type : `Partial<${type}>`;
			})];
		},
		templateExports: () => hasInheritedAttrs() ? [names.InheritedAttrs] : [],
		fallthroughProps: () => hasInheritedAttrs() ? [typeAliasRef(names.InheritedAttrs, getScriptLang(ir))] : [],
	};
}
