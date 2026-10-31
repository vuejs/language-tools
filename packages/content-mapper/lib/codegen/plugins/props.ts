import { getScriptLang, navigationFeatures } from '@vue/language-core';
import type { VueCodegenFile, VueCodegenFilePlugin } from '../plugin';
import { addDefineWithTypeTransforms } from '../script/scriptSetup';
import type { TsCode } from '../tsCode';
import {
	endOfLine,
	generateSfcBlockSection,
	generateTypeAlias,
	identifierRE,
	isTsLang,
	newLine,
	typeAliasRef,
} from '../writers';

/**
 * The props that `defineProps` declares: its type argument, or else its runtime argument, what it returns, which the
 * template reads, and the defaults of `withDefaults` or, from Vue 3.5, of a destructure. The parameter of the
 * `default` of a `defineModel` reads them too.
 */
export function createPropsPlugin({ ir, analysis, name }: VueCodegenFile): VueCodegenFilePlugin<TsCode> {
	const Props = name('Props');
	const props = name('props');
	const RuntimeProps = name('RuntimeProps');
	const defaults = name('defaults');
	const getRanges = () => analysis.getScriptSetupRanges();
	const getDefaults = (): 'withDefaults' | 'destructure' | undefined => {
		const defineProps = getRanges()?.defineProps;
		const withDefaults = getRanges()?.withDefaults;
		if (defineProps?.typeArg && withDefaults?.arg) {
			return 'withDefaults';
		}
		// Vue applies the defaults of a destructure from 3.5, unless `withDefaults` is used
		if (analysis.getResolvedOptions().target >= 3.5 && !withDefaults && defineProps?.destructuredDefaults?.length) {
			return 'destructure';
		}
	};
	return {
		rewrite({ scriptSetup }) {
			const ranges = getRanges();
			if (!scriptSetup || !ranges) {
				return;
			}
			const scriptLang = getScriptLang(ir);
			const runtimeDefineProps = ranges.defineProps?.typeArg ? undefined : ranges.defineProps;
			if (runtimeDefineProps && ranges.defineModel.some(({ defaultPropsArg }) => defaultPropsArg)) {
				// the parameter of `default` may have the name of the props, which `typeof` in its own annotation would
				// refer to
				scriptSetup.insertBefore(runtimeDefineProps.statement.end, [
					newLine,
					...generateTypeAlias(RuntimeProps, scriptLang, function*() {
						yield `typeof ${runtimeDefineProps.name ?? props}`;
					}),
				]);
			}
			const defaultPropsType = ranges.defineProps?.typeArg
				? Props
				: runtimeDefineProps
				? typeAliasRef(RuntimeProps, scriptLang)
				: `typeof ${props}`;
			for (const { defaultPropsArg } of ranges.defineModel) {
				if (!defaultPropsArg) {
					continue;
				}
				if (isTsLang(scriptLang)) {
					scriptSetup.insertAfter(defaultPropsArg.end, `: ${defaultPropsType}`);
				}
				else {
					scriptSetup.insertBefore(defaultPropsArg.start, `/** @type {${defaultPropsType}} */ `);
				}
			}
			if (ranges.defineProps) {
				const { name, statement, callExp, typeArg } = ranges.defineProps;
				const _callExp = ranges.withDefaults?.callExp ?? callExp;
				addDefineWithTypeTransforms(scriptSetup, statement, _callExp, typeArg, name, props, Props);
			}
		},
		setupBody: () => {
			const scriptSetup = ir.scriptSetup!;
			const defineProps = getRanges()?.defineProps;
			const withDefaults = getRanges()?.withDefaults;
			switch (getDefaults()) {
				case 'withDefaults':
					return [[
						`const ${defaults} = `,
						...generateSfcBlockSection(
							scriptSetup,
							withDefaults!.arg!.start,
							withDefaults!.arg!.end,
							{ features: navigationFeatures },
							true,
						),
						endOfLine,
						`void ${defaults}${endOfLine}`,
					]];
				case 'destructure':
					return [[
						`const ${defaults} = {${newLine}`,
						// a destructure default is the value, which the `default` option of a prop gives through a factory
						...defineProps!.destructuredDefaults!.map(({ key, value }) =>
							`${key}: () => (${scriptSetup.content.slice(value.start, value.end)}),${newLine}`
						),
						`}${endOfLine}`,
						`void ${defaults}${endOfLine}`,
					]];
			}
			return [];
		},
		props: () => {
			const defineProps = getRanges()?.defineProps;
			if (!defineProps) {
				return [];
			}
			const { name, typeArg, arg } = defineProps;
			return [{
				type: typeArg ? Props : undefined,
				local: `typeof ${name && identifierRE.test(name) ? name : props}`,
				runtime: arg && [
					...generateSfcBlockSection(ir.scriptSetup!, arg.start, arg.end, { features: navigationFeatures }, true),
				],
				defaults: getDefaults() && `typeof ${defaults}`,
			}];
		},
	};
}
