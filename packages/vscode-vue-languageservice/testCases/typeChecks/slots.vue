<template>
	<Comp value="1">
		<template #foo="bindings">{{ exactType(bindings, {} as string) }}</template>
	</Comp>
	<Comp :value="1">
		<template #foo="bindings">{{ exactType(bindings, {} as number) }}</template>
	</Comp>
</template>

<script lang="ts" setup>
import { VNode } from 'vue';
import { exactType } from './shared';

declare const Comp: new <T>(props: { value: T }) => {
	$props: typeof props;
	$slots: {
		foo: (_: T) => VNode[];
	},
};
</script>
