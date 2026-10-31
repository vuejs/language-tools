import type * as CompilerDOM from '@vue/compiler-dom';
import type { IR } from '@vue/language-core';
import { computed } from 'alien-signals';
import { getExportsOf, isSlice, type PluginEdits, type VueCodegenFilePlugin, type VueCodegenSlotCode } from './plugin';
import type { ModuleSlots } from './script';
import type { ComponentSlots } from './script/component';
import type { ScriptSetupSlots } from './script/scriptSetup';
import type { TemplateFunctionSlots } from './script/template';
import type { ElementSlots } from './template/element';
import type { SlotOutletSlots } from './template/slotOutlet';
import type { TsCode } from './tsCode';

/** The slots that the owners of the generated code declare, by name. */
export type CodegenSlots =
	& ModuleSlots
	& TemplateFunctionSlots
	& ComponentSlots
	& ScriptSetupSlots
	& ElementSlots
	& SlotOutletSlots;

/** A codegen plugin of a file, by the name in its errors. */
export interface FilePlugin extends VueCodegenFilePlugin<TsCode> {
	readonly name: string;
	/** The edits of its `rewrite`, whose cuts the slices of its slots are. */
	getEdits(): PluginEdits;
}

/** The slots of the plugins that `getPlugins` gives, each the contributions in the order of the plugins. */
export type MergedSlots = { readonly [K in keyof CodegenSlots]: () => CodegenSlots[K] };

type SlotKey = Exclude<keyof VueCodegenFilePlugin, 'rewrite'>;

/**
 * The code that `plugin` gives in the slot `key`, read after the edits of its rewrite, so that a slice in it is one of
 * their cuts: one rewrite of the script blocks of a snapshot of the file gives both.
 */
function read<K extends SlotKey>(plugin: FilePlugin, key: K): ReturnType<NonNullable<FilePlugin[K]>> | undefined {
	const slot = plugin[key] as (() => ReturnType<NonNullable<FilePlugin[K]>>) | undefined;
	if (!slot) {
		return;
	}
	const { cuts } = plugin.getEdits();
	const code = slot.call(plugin);
	checkSlices(plugin.name, cuts, code);
	return code;
}

function checkSlices(plugin: string, cuts: PluginEdits['cuts'], code: unknown) {
	if (isSlice(code)) {
		if (!cuts.has(code)) {
			throw new TypeError(`The codegen plugin '${plugin}' gave a slice that its writers did not cut.`);
		}
	}
	else if (Array.isArray(code)) {
		for (const part of code) {
			checkSlices(plugin, cuts, part);
		}
	}
	else if (code instanceof Map) {
		for (const codes of code.values()) {
			checkSlices(plugin, cuts, codes);
		}
	}
	else if (typeof code === 'object' && code !== null && 'name' in code && 'code' in code) {
		checkSlices(plugin, cuts, code.code);
	}
}

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
	) => computed(() => getPlugins().flatMap(plugin => (read(plugin, key) ?? []).map(toCodes)));
	const textSlot = <K extends 'componentSlots' | 'exposedInstanceTypes' | 'componentOptions' | 'fallthroughProps'>(
		key: K,
	) => computed(() => getPlugins().flatMap(plugin => [...read(plugin, key) ?? []]));
	return {
		templateContext: listSlot('templateContext'),
		templateBody: computed(() => getPlugins().flatMap(plugin => (read(plugin, 'templateBody') ?? []).flatMap(toCodes))),
		templateTypes: computed(() =>
			getPlugins().flatMap(plugin =>
				(read(plugin, 'templateTypes') ?? []).map(({ name, code }) => ({ name, code: toCodes(code) }))
			)
		),
		templateDollars: listSlot('templateDollars'),
		elementEnd: computed(() => {
			const merged = new Map<CompilerDOM.ElementNode, TsCode[]>();
			for (const plugin of getPlugins()) {
				for (const [node, codes] of read(plugin, 'elementEnd') ?? []) {
					merged.set(node, [...merged.get(node) ?? [], ...codes.flatMap(toCodes)]);
				}
			}
			return merged;
		}),
		props: listSlot('props'),
		emits: listSlot('emits'),
		expose: listSlot('expose'),
		generic: listSlot('generic'),
		declaredSlots: computed(() => {
			const declared = getPlugins().flatMap(plugin => {
				const slots = read(plugin, 'declaredSlots');
				return slots === undefined ? [] : [{ plugin: plugin.name, slots }];
			});
			if (declared.length > 1) {
				throw new TypeError(
					`The codegen plugins ${declared.map(({ plugin }) => `'${plugin}'`).join(' and ')} both declared the slots.`,
				);
			}
			return declared[0]?.slots;
		}),
		componentSlots: textSlot('componentSlots'),
		exposedInstanceTypes: textSlot('exposedInstanceTypes'),
		componentOptions: textSlot('componentOptions'),
		fallthroughProps: textSlot('fallthroughProps'),
		elements: listSlot('elements'),
		declarations: listSlot('declarations'),
		exports: computed(() =>
			getPlugins().flatMap(plugin => {
				const exports = read(plugin, 'exports');
				return exports === undefined ? [] : [getExportsOf(plugin.name, ir, exports)];
			})
		),
	};
}

function toCodes(code: VueCodegenSlotCode<TsCode>): readonly TsCode[] {
	return Array.isArray(code) ? code : [code as TsCode];
}
