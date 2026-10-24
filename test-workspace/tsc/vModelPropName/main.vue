<script setup lang="ts">
declare module 'vue' {
	export interface GlobalComponents {
		// a custom element, which has no `modelValue` prop
		'my-input': new () => { $props: { value?: number } };
	}
}

declare const Checked: new () => { $props: { modelValue?: number } };

declare const num: number;
declare const str: string;
</script>

<template>
	<my-input v-model="num" />
	<!-- @vue-expect-error `value` is a number -->
	<my-input v-model="str" />

	<Checked v-model="num" />
	<!-- @vue-expect-error `modelValue` is a number -->
	<Checked v-model="str" />
</template>
