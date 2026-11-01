<script setup lang="ts">
import { type FunctionalComponent, ref } from 'vue';
import { exactType } from '../../tsc/shared';
import Comp from './Comp.vue';

declare const Fn: FunctionalComponent<{ msg: string }>;
declare const Gen: new<T>(props: { value: T }) => {
	$props: { value: T };
	$emit: (event: 'change', value: T) => void;
};
declare const NoArgs: new() => { $props: { label?: string } };
declare const A: new() => { $props: { onChange?: (value: number) => void } };
declare const B: new() => { $props: { onChange?: (value: string) => void } };
declare const C: new() => { $props: { onChange?: (num: number) => void; extra?: string } };
declare const Untyped: {};

const notComp = 1;
const text = ref('');
const count = ref(0);
const differing = Math.random() > 0.5 ? A : B;
const identical = Math.random() > 0.5 ? A : C;
</script>

<template>
	<Comp a="x" @foo="exactType($event, undefined); count++" @bar="exactType($event, {} as number)" />
	<Comp v-model:a="text" />
	<Untyped v-model:b="text" @custom="exactType($event, {} as any)" />
	<Fn msg="hi" />
	<Gen :value="1" @change="exactType($event, {} as number)" />
	<NoArgs label="x" />
	<component :is="differing" @change="exactType($event, {} as any)" />
	<component :is="identical" @change="exactType($event, {} as number)" />
	<notComp />
	<!-- @vue-expect-error -->
	<Missing />
	<!-- @vue-expect-error -->
	<missing-comp></missing-comp>
	<Transition></Transition>
	<div @click="exactType($event, {} as PointerEvent)" @custom-event="exactType($event, {} as any)" />

	<!-- @vue-expect-error -->
	<Gen :value="1" @change="exactType($event, {} as string)" />
	<!-- @vue-expect-error -->
	<Comp @foo="exactType($event, {} as number)" />
	<!-- @vue-expect-error -->
	<Comp @bar="exactType($event, {} as string)" />
	<!-- @vue-expect-error -->
	<NoArgs :label="1" />
</template>
