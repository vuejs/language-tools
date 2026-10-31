import { getScriptLang } from '@vue/language-core';
import type { BuiltinPluginFile, FileCodegen } from '../filePlugin';
import { typeAliasRef } from '../writers';

/** The type of the attributes that fall through to the root of the template, which the component takes as props. */
export function createInheritedAttrsPlugin({ ir, analysis, getTemplateVars, name }: BuiltinPluginFile): FileCodegen {
	const InheritedAttrs = name('InheritedAttrs');
	const hasInheritedAttrs = () => !!getTemplateVars()?.inheritedAttrVars.size;
	return {
		templateTypes: () => {
			if (!hasInheritedAttrs()) {
				return [];
			}
			const type = [...getTemplateVars()!.inheritedAttrVars].map(name => `typeof ${name}`).join(` & `);
			const { checkRequiredFallthroughAttributes } = analysis.getResolvedOptions();
			return [{
				name: InheritedAttrs,
				code: [checkRequiredFallthroughAttributes ? type : `Partial<${type}>`],
			}];
		},
		fallthroughProps: () => hasInheritedAttrs() ? [typeAliasRef(InheritedAttrs, getScriptLang(ir))] : [],
		templateDollars: () => {
			if (!analysis.getTemplateScope().dollarVars.has('$attrs')) {
				return [];
			}
			const type = `import('${analysis.getResolvedOptions().lib}').ComponentPublicInstance['$attrs']`;
			return [[
				`{ $attrs: ${type}`,
				hasInheritedAttrs() ? ` & ${typeAliasRef(InheritedAttrs, getScriptLang(ir))}` : ``,
				` }`,
			]];
		},
	};
}
