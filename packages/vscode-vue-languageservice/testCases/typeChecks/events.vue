<template>
	<div @click="exactType($event, {} as MouseEvent)"></div>

	<C1 @foo-bar="exactType($event, {} as number)" />
	<C2 @foo-bar="exactType($event, {} as number)" />
	<C3 @foo-bar="exactType($event, {} as number)" />
	<C4 value="1" @foo-bar="exactType($event, {} as string)" />
	<C4 :value="1" @foo-bar="exactType($event, {} as number)" />

	<C1 @fooBar="exactType($event, {} as number)" />
	<C2 @fooBar="exactType($event, {} as number)" />
	<C3 @fooBar="exactType($event, {} as number)" />
	<C4 value="1" @fooBar="exactType($event, {} as string)" />
	<C4 :value="1" @fooBar="exactType($event, {} as number)" />
</template>

<script lang="ts" setup>
import { defineComponent, FunctionalComponent, PropType } from 'vue';
import { exactType } from './shared';

const C1 = defineComponent({ emits: { fooBar: (_num: number) => true } });
const C2 = defineComponent({ props: { onFooBar: Function as PropType<(num: number) => void> } });
declare const C3: FunctionalComponent<{}, { fooBar(num: number): true }>;
declare const C4: new <T>(props: { value: T }) => {
	$props: typeof props;
	$emit: { (event: 'fooBar', e: T): void; };
};
</script>
