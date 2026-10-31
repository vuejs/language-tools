import { computed } from 'alien-signals';
import type { VueCodegenFile, VueCodegenTemplate, VueCodegenWriters } from './plugin';
import type { ModuleSlots } from './script';
import type { ComponentSlots } from './script/component';
import type { ScriptSetupSlots } from './script/scriptSetup';
import type { TemplateFunctionSlots } from './script/template';
import type { ElementSlots } from './template/element';

/** What a built-in codegen plugin reads: the same as a codegen plugin, its names, and the types of the template. */
export interface BuiltinPluginFile extends VueCodegenFile {
	/** A name of the plugin for an identifier that it declares, which no other code of the file declares. */
	name(hint: string): string;
	template: VueCodegenTemplate;
}

/** The slots that the owners of the generated code declare, by name. */
export type CodegenSlots = ModuleSlots & TemplateFunctionSlots & ComponentSlots & ScriptSetupSlots & ElementSlots;

/**
 * What a codegen plugin, built-in or of `vueCompilerOptions.plugins`, gives for one file. It edits the user's code of
 * the script blocks through its writers, and writes its code into the slots that the owners of the generated code
 * declare; it knows neither their code nor the other plugins. Each slot is read lazily, so that an owner depends only on
 * the slots that it reads.
 */
export type FileCodegen =
	& { rewrite?(writers: VueCodegenWriters): void }
	& { readonly [K in keyof CodegenSlots]?: () => CodegenSlots[K] };

export interface FilePlugin extends FileCodegen {
	/** The name in the errors of its edits. */
	readonly name: string;
}

export type BuiltinPluginFactory = (file: BuiltinPluginFile) => FileCodegen;

/** The slots of `plugins`, each the contributions in the order of `plugins`. */
export type MergedSlots = { readonly [K in keyof CodegenSlots]: () => CodegenSlots[K] };

export function mergeSlots(plugins: readonly FilePlugin[]): MergedSlots {
	const listSlot = <K extends keyof CodegenSlots>(key: K) =>
		computed(() => plugins.flatMap(plugin => (plugin[key]?.() ?? []) as unknown[])) as () => CodegenSlots[K];
	const mapSlot = <K extends keyof CodegenSlots>(key: K) =>
		computed(() => {
			const merged = new Map<unknown, unknown[]>();
			for (const plugin of plugins) {
				for (const [node, values] of (plugin[key]?.() ?? new Map()) as Map<unknown, unknown[]>) {
					merged.set(node, [...merged.get(node) ?? [], ...values]);
				}
			}
			return merged;
		}) as () => CodegenSlots[K];
	return {
		declarations: listSlot('declarations'),
		elements: listSlot('elements'),
		exports: listSlot('exports'),
		templateTypes: listSlot('templateTypes'),
		templateDollars: listSlot('templateDollars'),
		templateContext: listSlot('templateContext'),
		templateBody: listSlot('templateBody'),
		componentOptions: listSlot('componentOptions'),
		fallthroughProps: listSlot('fallthroughProps'),
		props: listSlot('props'),
		emits: listSlot('emits'),
		expose: listSlot('expose'),
		exposedInstanceTypes: listSlot('exposedInstanceTypes'),
		elementEnd: mapSlot('elementEnd'),
	};
}
