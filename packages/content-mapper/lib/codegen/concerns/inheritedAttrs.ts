import { getScriptLang } from '@vue/language-core';
import type { CodegenConcern, CodegenConcernFile } from '../concern';
import { names } from '../names';
import { generateTypeAlias, typeAliasRef } from '../writers';

/** The type of the attributes that fall through to the root of the template, which the component takes as props. */
export function createInheritedAttrsConcern({ ir, analysis, getTemplateTypes }: CodegenConcernFile): CodegenConcern {
	const hasInheritedAttrs = () => getTemplateTypes().has(names.InheritedAttrs);
	return {
		generateTemplateEnd({ inheritedAttrVars }) {
			if (!inheritedAttrVars.size) {
				return;
			}
			const type = [...inheritedAttrVars].map(name => `typeof ${name}`).join(` & `);
			const { checkRequiredFallthroughAttributes } = analysis.getResolvedOptions();
			return {
				types: [names.InheritedAttrs],
				codes: [...generateTypeAlias(names.InheritedAttrs, getScriptLang(ir), function*() {
					yield checkRequiredFallthroughAttributes ? type : `Partial<${type}>`;
				})],
			};
		},
		templateExports: () => hasInheritedAttrs() ? [names.InheritedAttrs] : [],
		fallthroughProps: () => hasInheritedAttrs() ? [typeAliasRef(names.InheritedAttrs, getScriptLang(ir))] : [],
	};
}
