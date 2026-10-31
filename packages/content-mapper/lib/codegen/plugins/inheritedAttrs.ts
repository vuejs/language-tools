import { getScriptLang } from '@vue/language-core';
import type { BuiltinPluginFile, FilePlugin } from '../filePlugin';
import { names } from '../names';
import { typeAliasRef } from '../writers';

/** The type of the attributes that fall through to the root of the template, which the component takes as props. */
export function createInheritedAttrsPlugin({ ir, analysis, getTemplateVars }: BuiltinPluginFile): FilePlugin {
	const hasInheritedAttrs = () => !!getTemplateVars()?.inheritedAttrVars.size;
	return {
		name: 'vue:inherited-attrs',
		templateTypes: () => {
			if (!hasInheritedAttrs()) {
				return [];
			}
			const type = [...getTemplateVars()!.inheritedAttrVars].map(name => `typeof ${name}`).join(` & `);
			const { checkRequiredFallthroughAttributes } = analysis.getResolvedOptions();
			return [{
				name: names.InheritedAttrs,
				code: [checkRequiredFallthroughAttributes ? type : `Partial<${type}>`],
			}];
		},
		fallthroughProps: () => hasInheritedAttrs() ? [typeAliasRef(names.InheritedAttrs, getScriptLang(ir))] : [],
		templateDollars: () => {
			if (!analysis.getTemplateScope().dollarVars.has('$attrs')) {
				return [];
			}
			const type = `import('${analysis.getResolvedOptions().lib}').ComponentPublicInstance['$attrs']`;
			return [[
				`{ $attrs: ${type}`,
				hasInheritedAttrs() ? ` & ${typeAliasRef(names.InheritedAttrs, getScriptLang(ir))}` : ``,
				` }`,
			]];
		},
	};
}
