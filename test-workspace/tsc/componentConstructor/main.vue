<script setup lang="ts">
import { type DefineComponent, defineComponent, type FunctionalComponent, h } from 'vue';
import { exactType } from '../shared';
import Generic from './generic.vue';

declare const Over: {
	new(props: { a: string }): { $props: { a: string; onPick?: (v: string) => void } };
	new(props: { b: number }): { $props: { b: number; onPick?: (v: number) => void } };
};
type GenCtor = new<T>(props: { items: T[] }) => { $props: { items: T[]; onSelect?: (v: T) => void } };
declare const GenAnd: DefineComponent<{ items?: unknown[] }> & GenCtor;
declare const AndGen: GenCtor & DefineComponent<{ items?: unknown[] }>;
type SlotsCtor = new<T>(props: { items: T[] }, slots: { default?: (props: { item: T }) => any }) => {
	$props: { items: T[]; onSelect?: (v: T) => void };
	$slots: { default?: (props: { item: T }) => any };
};
declare const SlotsAnd: DefineComponent<{ items?: unknown[] }> & SlotsCtor;
declare const AndSlots: SlotsCtor & DefineComponent<{ items?: unknown[] }>;
declare const Gen: new<T>(props: { value: T }) => { $props: { value: T; onChange?: (v: T) => void } };
const GenFn = defineComponent(
	<T extends string | number>(props: { value: T; onUpdate?: (v: T) => void }) => () => h('div', props.value),
);
declare const Abs: abstract new() => { $props: { x?: number } };
declare const GenC: new<T extends string = 'a'>(props: { v?: T }) => { $props: { v?: T; onV?: (v: T) => void } };
declare const NoArgs: new() => { $props: { label?: string; onPick?: (v: string) => void } };
declare const Fn: FunctionalComponent<{ msg: string }, { pick: (v: string) => void }>;
declare const Untyped: {};
declare const anyValue: any;
</script>

<template>
	<!-- overloads resolve from the props -->
	<Over a="x" @pick="exactType($event, {} as string)" />
	<Over :b="1" @pick="exactType($event, {} as number)" />
	<Over :a="anyValue" @pick="exactType($event, {} as string)" />

	<!-- generic construct signatures intersected with DefineComponent -->
	<GenAnd :items="[1]" @select="exactType($event, {} as number)" />
	<AndGen :items="[1]" @select="exactType($event, {} as number)" />
	<SlotsAnd :items="[1]" @select="exactType($event, {} as number)" #default="{ item }">
		{{ exactType(item, {} as number) }}
	</SlotsAnd>
	<AndSlots :items="[1]" @select="exactType($event, {} as number)" #default="{ item }">
		{{ exactType(item, {} as number) }}
	</AndSlots>

	<!-- type parameters infer with fallthrough attributes -->
	<Gen :value="1" class="x" @change="exactType($event, {} as number)" />

	<GenFn value="x" @update="exactType($event, {} as 'x')" />
	<Generic value="x" @update="exactType($event, {} as 'x')" />
	<GenC v="b" @v="exactType($event, {} as 'b')" />
	<GenC @v="exactType($event, {} as 'a')" />
	<Abs :x="1" />
	<NoArgs label="x" @pick="exactType($event, {} as string)" />
	<Fn msg="x" @pick="exactType($event, {} as string)" />
	<Untyped />
</template>
