import { getScriptLang, navigationFeatures } from '@vue/language-core';
import { computed } from 'alien-signals';
import type { VueCodegenFile, VueCodegenFilePlugin } from '../plugin';
import { addDefineWithTypeTransforms } from '../script/scriptSetup';
import { Boundary, synthesizedIgnore, type TsCode } from '../tsCode';
import { endOfLine, newLine, typeAliasRef } from '../writers';
import { generatePropertyKey } from '../writers/stringLiteralKey';

/**
 * The slots of the component: what `defineSlots` declares, which the slot outlets of the template are checked against,
 * or else the type of the slots that the template renders.
 */
export function createSlotsPlugin(
	{ ir, analysis, template, name }: VueCodegenFile,
): VueCodegenFilePlugin<TsCode> {
	const Slots = name('Slots');
	const slots = name('slots');
	const getDefineSlots = () => analysis.getScriptSetupRanges()?.defineSlots;
	// the template types its slot outlets only when no plugin declares the slots
	const getTemplateSlots = computed(() => {
		const { slots, dynamicSlots } = analysis.getTemplateScope();
		const outlet = dynamicSlots[0] ?? slots[0]?.node;
		if (outlet && template.slotOutletTypes(outlet)) {
			return { slots, dynamicSlots };
		}
	});
	const getSlotsType = () =>
		getDefineSlots() || getTemplateSlots() ? typeAliasRef(Slots, getScriptLang(ir)) : undefined;
	return {
		rewrite({ scriptSetup }) {
			const defineSlots = getDefineSlots();
			if (!scriptSetup || !defineSlots) {
				return;
			}
			const { name, statement, callExp, typeArg } = defineSlots;
			addDefineWithTypeTransforms(scriptSetup, statement, callExp, typeArg, name, slots, Slots);
			if (!name) {
				scriptSetup.insertAfter(statement.end, `${newLine}void ${slots}${endOfLine}`);
			}
		},
		declaredSlots: () => {
			const defineSlots = getDefineSlots();
			return defineSlots && (defineSlots.name ?? slots);
		},
		componentSlots: () => {
			const type = getSlotsType();
			return type ? [type] : [];
		},
		templateTypes: () => {
			const templateSlots = getTemplateSlots();
			if (!templateSlots) {
				return [];
			}
			const templateBlock = ir.template!;
			const { slots, dynamicSlots } = templateSlots;
			return [{
				name: Slots,
				code: [...(function*(): Generator<TsCode> {
					yield `{}`;
					for (const node of dynamicSlots) {
						const { name, props } = template.slotOutletTypes(node)!;
						yield `${newLine}& { [K in ${name}]?: (props: ${props}) => any }`;
					}
					for (const slot of slots) {
						yield `${newLine}& { `;
						const ignore = yield* Boundary.start(templateBlock, 0, 0, synthesizedIgnore);
						if (slot.name && slot.offset !== undefined) {
							yield* generatePropertyKey(slot.name, templateBlock, slot.offset, { features: navigationFeatures });
						}
						else {
							const boundary = yield* Boundary.start(templateBlock, ...slot.tagRange, { features: navigationFeatures });
							yield `default`;
							yield boundary.end();
						}
						yield ignore.end();
						yield `?: (props: ${template.slotOutletTypes(slot.node)!.props}) => any }`;
					}
				})()],
			}];
		},
		templateDollars: () => {
			if (!analysis.getTemplateScope().dollarVars.has('$slots')) {
				return [];
			}
			return [[`{ $slots: ${getSlotsType() ?? `{}`} }`]];
		},
	};
}
