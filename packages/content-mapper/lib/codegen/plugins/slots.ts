import { getScriptLang, navigationFeatures } from '@vue/language-core';
import { computed } from 'alien-signals';
import type { BuiltinPluginFile, FilePlugin } from '../filePlugin';
import { names } from '../names';
import { Boundary, synthesizedIgnore, type TsCode } from '../tsCode';
import { newLine, typeAliasRef } from '../writers';
import { generatePropertyKey } from '../writers/stringLiteralKey';

/** The type of the slots that the template renders, unless `defineSlots` declares them. */
export function createSlotsPlugin({ ir, analysis, getTemplateVars }: BuiltinPluginFile): FilePlugin {
	const hasDefineSlots = () => !!analysis.getScriptSetupRanges()?.defineSlots;
	const getTemplateSlots = computed(() => {
		const { slots, dynamicSlots } = analysis.getTemplateScope();
		const vars = getTemplateVars();
		if (vars && !hasDefineSlots() && (slots.length || dynamicSlots.length)) {
			return { slots, dynamicSlots, vars };
		}
	});
	return {
		name: 'vue:slots',
		templateTypes: () => {
			const templateSlots = getTemplateSlots();
			if (!templateSlots) {
				return [];
			}
			const template = ir.template!;
			const { slots, dynamicSlots, vars } = templateSlots;
			return [{
				name: names.Slots,
				code: [...(function*(): Generator<TsCode> {
					yield `{}`;
					for (const node of dynamicSlots) {
						const { expVar, propsVar } = vars.slotVars.get(node)!;
						yield `${newLine}& { [K in NonNullable<typeof ${expVar}>]?: (props: typeof ${propsVar}) => any }`;
					}
					for (const slot of slots) {
						yield `${newLine}& { `;
						const ignore = yield* Boundary.start(template, 0, 0, synthesizedIgnore);
						if (slot.name && slot.offset !== undefined) {
							yield* generatePropertyKey(slot.name, template, slot.offset, { features: navigationFeatures });
						}
						else {
							const boundary = yield* Boundary.start(template, ...slot.tagRange, { features: navigationFeatures });
							yield `default`;
							yield boundary.end();
						}
						yield ignore.end();
						yield `?: (props: typeof ${vars.slotVars.get(slot.node)!.propsVar}) => any }`;
					}
				})()],
			}];
		},
		templateDollars: () => {
			if (!analysis.getTemplateScope().dollarVars.has('$slots')) {
				return [];
			}
			const type = hasDefineSlots() || getTemplateSlots() ? typeAliasRef(names.Slots, getScriptLang(ir)) : `{}`;
			return [[`{ $slots: ${type} }`]];
		},
	};
}
