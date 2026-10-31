import type * as CompilerDOM from '@vue/compiler-dom';
import type { IR } from '@vue/language-core';
import { computed } from 'alien-signals';
import { getExportsOf, type VueCodegenFilePlugin, type VueCodegenSlotCode } from './plugin';
import type { ModuleSlots } from './script';
import type { ComponentSlots } from './script/component';
import type { ScriptSetupSlots } from './script/scriptSetup';
import type { TemplateFunctionSlots } from './script/template';
import type { ElementSlots } from './template/element';
import type { TsCode } from './tsCode';

/** The slots that the owners of the generated code declare, by name. */
export type CodegenSlots = ModuleSlots & TemplateFunctionSlots & ComponentSlots & ScriptSetupSlots & ElementSlots;

/** A codegen plugin of a file, by the name in its errors. */
export interface FilePlugin extends VueCodegenFilePlugin<TsCode> {
	readonly name: string;
}

/** The slots of the plugins that `getPlugins` gives, each the contributions in the order of the plugins. */
export type MergedSlots = { readonly [K in keyof CodegenSlots]: () => CodegenSlots[K] };

export function mergeSlots(getPlugins: () => readonly FilePlugin[], ir: IR): MergedSlots {
	const listSlot = <
		K extends
			| 'templateContext'
			| 'templateDollars'
			| 'props'
			| 'emits'
			| 'expose'
			| 'generic'
			| 'elements'
			| 'declarations',
	>(
		key: K,
	) => computed(() => getPlugins().flatMap(plugin => (plugin[key]?.() ?? []).map(toCodes)));
	const textSlot = <K extends 'exposedInstanceTypes' | 'componentOptions' | 'fallthroughProps'>(key: K) =>
		computed(() => getPlugins().flatMap(plugin => [...plugin[key]?.() ?? []]));
	return {
		templateContext: listSlot('templateContext'),
		templateBody: computed(() => getPlugins().flatMap(plugin => (plugin.templateBody?.() ?? []).flatMap(toCodes))),
		templateTypes: computed(() =>
			getPlugins().flatMap(plugin =>
				(plugin.templateTypes?.() ?? []).map(({ name, code }) => ({ name, code: toCodes(code) }))
			)
		),
		templateDollars: listSlot('templateDollars'),
		elementEnd: computed(() => {
			const merged = new Map<CompilerDOM.ElementNode, TsCode[]>();
			for (const plugin of getPlugins()) {
				for (const [node, codes] of plugin.elementEnd?.() ?? []) {
					merged.set(node, [...merged.get(node) ?? [], ...codes.flatMap(toCodes)]);
				}
			}
			return merged;
		}),
		props: listSlot('props'),
		emits: listSlot('emits'),
		expose: listSlot('expose'),
		generic: listSlot('generic'),
		exposedInstanceTypes: textSlot('exposedInstanceTypes'),
		componentOptions: textSlot('componentOptions'),
		fallthroughProps: textSlot('fallthroughProps'),
		elements: listSlot('elements'),
		declarations: listSlot('declarations'),
		exports: computed(() =>
			getPlugins().flatMap(plugin => {
				const exports = plugin.exports?.();
				return exports === undefined ? [] : [getExportsOf(plugin.name, ir, exports)];
			})
		),
	};
}

function toCodes(code: VueCodegenSlotCode<TsCode>): readonly TsCode[] {
	return Array.isArray(code) ? code : [code as TsCode];
}
