<script setup lang="ts">
import { ref } from 'vue';
import { exactType } from '../shared';
import Child from './child.vue';
import OverloadEmits from './overloadEmits.vue';

declare const Overloaded: new() => {
	$props: { onChange?: { (value: number): void; (value: string, extra: boolean): void } };
};
declare const SameOverloads: new() => {
	$props: { onChange?: { (value: number): void; (value: number): void } };
};
declare const A: new() => { $props: { onChange?: (value: number) => void } };
declare const B: new() => { $props: { onChange?: (value: string) => void } };
declare const C: new() => { $props: { onChange?: (num: number) => void; extra?: string } };
declare const Union: new() => { $props: { onChange?: ((value: number) => void) | ((value: string) => void) } };
declare const Untyped: {};

const text = ref('');
const count = ref(0);
const differing = Math.random() > 0.5 ? A : B;
const identical = Math.random() > 0.5 ? A : C;
</script>

<template>
	<!-- no parameters: `$event` is `undefined` -->
	<Child @foo="exactType($event, undefined); count++" />
	<Child @bar="exactType($event, {} as number); count++" />
	<Child v-model:a="text" />
	<Child @update:a="exactType($event, {} as string); text = $event" />

	<!-- overloads or union members of different parameters: `any` -->
	<Overloaded @change="exactType($event, {} as any); count++" />
	<Union @change="exactType($event, {} as any); count++" />
	<component :is="differing" @change="exactType($event, {} as any); count++" />

	<!-- one signature with a union of parameter lists -->
	<OverloadEmits @change="exactType($event, {} as string | number); count++" />

	<!-- the same parameters -->
	<OverloadEmits @same="exactType($event, {} as number); count++" />
	<SameOverloads @change="exactType($event, {} as number); count++" />
	<component :is="identical" @change="exactType($event, {} as number); count++" />

	<!-- no handler type -->
	<Untyped v-model:b="text" @custom="exactType($event, {} as any); count++" />

	<div @click="exactType($event, {} as PointerEvent); count++" />
	<div @custom-event="exactType($event, {} as any); count++" />
	<template v-for="i in 1" :key="i" @custom="exactType($event, {} as any); count++" />
</template>
