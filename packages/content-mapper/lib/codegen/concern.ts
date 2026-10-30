import type { CodeSource, IR, IRScriptSetup, ScriptAnalysis, TypeScript } from '@vue/language-core';
import { computed } from 'alien-signals';
import type { CoreRewriteWriter } from 'muggle-string';
import type { TsCodeData } from './piece';
import type { ModuleSlots } from './script';
import type { TemplateFunctionSlots } from './script/template';
import type { ElementSlots } from './template/element';

/** What a concern of the built-in codegen reads: the same as a codegen plugin. */
export interface CodegenConcernFile {
	ts: TypeScript;
	fileName: string;
	ir: IR;
	analysis: ScriptAnalysis;
}

/** The slots that the owners of the generated code declare, by name. */
export type CodegenSlots = ModuleSlots & TemplateFunctionSlots & ElementSlots;

/**
 * A concern of the built-in codegen, e.g. style. It writes its code into the slots that the owners of the generated
 * code declare, and knows neither their code nor the other concerns. Each slot is read lazily, so that an owner
 * depends only on the slots that it reads.
 */
export type CodegenConcern =
	& { readonly [K in keyof CodegenSlots]?: () => CodegenSlots[K] }
	& {
		/** Edits the user's code of `<script setup>`, after the transforms of the macros, with the core writer. */
		rewriteScriptSetup?(core: CoreRewriteWriter<CodeSource, TsCodeData>, scriptSetup: IRScriptSetup): void;
	};

export type CodegenConcernFactory = (file: CodegenConcernFile) => CodegenConcern;

/** The slots of `concerns`, each the contributions in the order of `concerns`. */
export type MergedSlots = { readonly [K in keyof CodegenSlots]: () => CodegenSlots[K] };

export function mergeSlots(concerns: readonly CodegenConcern[]): MergedSlots {
	const listSlot = <K extends keyof CodegenSlots>(key: K) =>
		computed(() => concerns.flatMap(concern => (concern[key]?.() ?? []) as unknown[])) as () => CodegenSlots[K];
	const mapSlot = <K extends keyof CodegenSlots>(key: K) =>
		computed(() => {
			const merged = new Map<unknown, unknown[]>();
			for (const concern of concerns) {
				for (const [node, values] of (concern[key]?.() ?? new Map()) as Map<unknown, unknown[]>) {
					merged.set(node, [...merged.get(node) ?? [], ...values]);
				}
			}
			return merged;
		}) as () => CodegenSlots[K];
	return {
		moduleEnd: listSlot('moduleEnd'),
		templateTypes: listSlot('templateTypes'),
		templateContext: listSlot('templateContext'),
		templateBody: listSlot('templateBody'),
		templateExports: listSlot('templateExports'),
		elementEnd: mapSlot('elementEnd'),
		renamedElsewhere: mapSlot('renamedElsewhere'),
	};
}
