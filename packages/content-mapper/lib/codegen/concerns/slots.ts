import { getScriptLang, navigationFeatures } from '@vue/language-core';
import { computed } from 'alien-signals';
import type { CodegenConcern, CodegenConcernFile } from '../concern';
import { names } from '../names';
import { Boundary, synthesizedIgnore } from '../tsCode';
import { generateTypeAlias, newLine } from '../writers';
import { generatePropertyKey } from '../writers/stringLiteralKey';

/** The type of the slots that the template renders, unless `defineSlots` declares them. */
export function createSlotsConcern({ ir, analysis, getTemplateVars }: CodegenConcernFile): CodegenConcern {
	const hasDefineSlots = () => !!analysis.getScriptSetupRanges()?.defineSlots;
	const getTemplateSlots = computed(() => {
		const { slots, dynamicSlots } = analysis.getTemplateScope();
		const vars = getTemplateVars();
		if (vars && !hasDefineSlots() && (slots.length || dynamicSlots.length)) {
			return { slots, dynamicSlots, vars };
		}
	});
	return {
		// with `defineSlots`, the template function declares the type of the slots that it reads
		templateTypes: () => getTemplateVars() && (hasDefineSlots() || getTemplateSlots()) ? [names.Slots] : [],
		templateEnd: () => {
			const templateSlots = getTemplateSlots();
			if (!templateSlots) {
				return [];
			}
			const template = ir.template!;
			const { slots, dynamicSlots, vars } = templateSlots;
			return [...generateTypeAlias(names.Slots, getScriptLang(ir), function*() {
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
			})];
		},
		templateExports: () => getTemplateSlots() ? [names.Slots] : [],
	};
}
