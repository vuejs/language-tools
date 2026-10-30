import { getScriptLang } from '@vue/language-core';
import type { CodegenConcern, CodegenConcernFile } from '../concern';
import { names } from '../names';
import type { TsCode } from '../tsCode';
import { endOfLine, generateTypedVar, isTsLang, newLine, typeAliasRef } from '../writers';

/**
 * The `$` names that the template reads (`$slots`, `$attrs`, `$refs`, `$el`): their variable at the end of the template,
 * which the template function returns, and the types of `useAttrs()` and `useSlots()` that it infers.
 */
export function createDollarsConcern(
	{ ir, analysis, getTemplateVars, getTemplateTypes }: CodegenConcernFile,
): CodegenConcern {
	const hasDollars = () => !!getTemplateVars() && !!analysis.getTemplateScope().dollarVars.size;
	return {
		templateTypes: () => hasDollars() ? [names.dollars] : [],
		templateEnd: () => {
			if (!hasDollars()) {
				return [];
			}
			const { dollarVars } = analysis.getTemplateScope();
			const types = getTemplateTypes();
			const { lib } = analysis.getResolvedOptions();
			const scriptLang = getScriptLang(ir);
			return [...generateTypedVar('var', names.dollars, scriptLang, function*(): Generator<TsCode> {
				yield `{${newLine}`;
				if (dollarVars.has('$slots')) {
					const type = types.has(names.Slots) ? typeAliasRef(names.Slots, scriptLang) : `{}`;
					yield `$slots: ${type}${endOfLine}`;
				}
				if (dollarVars.has('$attrs')) {
					yield `$attrs: import('${lib}').ComponentPublicInstance['$attrs']`;
					if (types.has(names.InheritedAttrs)) {
						yield ` & ${typeAliasRef(names.InheritedAttrs, scriptLang)}`;
					}
					yield endOfLine;
				}
				if (dollarVars.has('$refs')) {
					const type = types.has(names.TemplateRefs) ? typeAliasRef(names.TemplateRefs, scriptLang) : `{}`;
					yield `$refs: ${type}${endOfLine}`;
				}
				if (dollarVars.has('$el')) {
					const type = types.has(names.RootEl) ? typeAliasRef(names.RootEl, scriptLang) : `any`;
					yield `$el: ${type}${endOfLine}`;
				}
				yield `} & { [K in keyof import('${lib}').ComponentPublicInstance]: unknown }`;
			})];
		},
		templateExportValues: () => hasDollars() ? [names.dollars] : [],
		rewriteScriptSetup(core) {
			const scriptSetupRanges = analysis.getScriptSetupRanges();
			if (!scriptSetupRanges) {
				return;
			}
			const vueCompilerOptions = analysis.getResolvedOptions();
			const isTs = isTsLang(getScriptLang(ir));
			const casts = [
				...vueCompilerOptions.inferTemplateDollarAttrs
					? scriptSetupRanges.useAttrs.map(call => [call, '$attrs'] as const)
					: [],
				...vueCompilerOptions.inferTemplateDollarSlots
					? scriptSetupRanges.useSlots.map(call => [call, '$slots'] as const)
					: [],
			];
			for (const [{ callExp }, name] of casts) {
				const type = `typeof ${names.dollars}.${name}`;
				core.insertBefore(callExp.start, isTs ? `(` : `/** @type {${type}} */ (`);
				core.insertAfter(callExp.end, isTs ? ` as ${type})` : `)`);
			}
		},
	};
}
