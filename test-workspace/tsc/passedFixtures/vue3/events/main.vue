<template>
	<div @click="exactType($event, {} as MouseEvent)"></div>

	<!-- #3445 -->
	<div @click="function (e) { exactType(e, {} as MouseEvent) }"></div>

	<C1 @foo-bar="exactType($event, {} as number)" @bar-baz="exactType($event, {} as number)" />
	<C2 @foo-bar="exactType($event, {} as number)" />
	<C3 @foo-bar="exactType($event, {} as number)" />
	<C4 value="1" @foo-bar="exactType($event, {} as string)" />
	<C4 :value="1" @foo-bar="exactType($event, {} as number)" />

	<C1 @fooBar="exactType($event, {} as number)" @barBaz="exactType($event, {} as any)" />
	<C2 @fooBar="exactType($event, {} as number)" />
	<C3 @fooBar="exactType($event, {} as number)" />
	<C4 value="1" @fooBar="exactType($event, {} as string)" />
	<C4 :value="1" @fooBar="exactType($event, {} as number)" />

	<C5 @a="exactType($event, {} as string)"></C5>

	<!-- $emit has high priority then $props -->
	<!-- <C6 @foo="exactType($event, {} as number)" /> -->

	<!-- override native event -->
	<C7 @click="exactType($event, {} as number)" />
	<C8 @click="exactType($event, {} as number)" />
	<C8 :onClick="arg => exactType(arg, {} as number)" />

	<!-- https://github.com/vuejs/language-tools/issues/1023 -->
	<!-- <C10 @foo-bar="exactType($event, {} as number)"></C10> -->

	<!-- invalid component type don't fallback to native event type -->
	<C9 @click="exactType($event, {} as any)" />
</template>

<script lang="ts" setup>
import { defineComponent, FunctionalComponent, PropType } from 'vue';
import { exactType } from '../../shared';
import C5 from './union_type.vue';

const C1 = defineComponent({ emits: { fooBar: (_num: number) => true, 'bar-baz': (_num: number) => true } });
const C2 = defineComponent({ props: { onFooBar: {} as PropType<(num: number) => void> } });
// const C6 = defineComponent({ props: { onFoo: {} as PropType<(_num: string) => void> }, emits: { foo: (_num: number) => true } });
const C7 = defineComponent({ emits: { click: (_num: number) => true } });
const C8 = defineComponent({ props: { onClick: {} as PropType<(_num: number) => void> } });
</script>

<script lang="ts">
declare const C3: FunctionalComponent<{}, { fooBar(num: number): true; }>;
declare const C4: new <T>(props: { value: T; }) => {
	$props: typeof props;
	$emit: { (event: 'fooBar', e: T): void; };
};
declare const C9: {};
// declare const C10: new () => {
// 	$props: { 'onFoo-bar'?: (num: number) => void; };
// };
</script>
