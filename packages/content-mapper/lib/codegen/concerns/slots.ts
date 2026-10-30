import { getScriptLang, navigationFeatures } from '@vue/language-core';
import type { CodegenConcern, CodegenConcernFile } from '../concern';
import { names } from '../names';
import type { TemplateCode } from '../template';
import { Boundary, synthesizedIgnore } from '../tsCode';
import { generateTypeAlias, newLine } from '../writers';

/** The type of the slots that the template renders, unless `defineSlots` declares them. */
export function createSlotsConcern({ ir, analysis, getTemplateTypes }: CodegenConcernFile): CodegenConcern {
	const hasDefineSlots = () => !!analysis.getScriptSetupRanges()?.defineSlots;
	return {
		generateTemplateEnd({ slots, dynamicSlots }) {
			if (hasDefineSlots()) {
				return { types: [names.Slots], codes: [] };
			}
			if (!ir.template || (!slots.length && !dynamicSlots.length)) {
				return;
			}
			const template = ir.template;
			return {
				types: [names.Slots],
				codes: [...generateTypeAlias(names.Slots, getScriptLang(ir), function*(): Generator<TemplateCode> {
					yield `{}`;
					for (const { expVar, propsVar } of dynamicSlots) {
						yield `${newLine}& { [K in NonNullable<typeof ${expVar}>]?: (props: typeof ${propsVar}) => any }`;
					}
					for (const slot of slots) {
						yield `${newLine}& { `;
						const ignore = yield* Boundary.start(template, 0, 0, synthesizedIgnore);
						if (slot.name && slot.offset !== undefined) {
							yield { key: slot.name, offset: slot.offset, features: { features: navigationFeatures } };
						}
						else {
							const boundary = yield* Boundary.start(template, ...slot.tagRange, { features: navigationFeatures });
							yield `default`;
							yield boundary.end();
						}
						yield ignore.end();
						yield `?: (props: typeof ${slot.propsVar}) => any }`;
					}
				})],
			};
		},
		templateExports: () => getTemplateTypes().has(names.Slots) && !hasDefineSlots() ? [names.Slots] : [],
	};
}
