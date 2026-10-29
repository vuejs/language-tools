<script setup lang="ts">
declare module 'vue' {
	export interface GlobalComponents {
		// custom elements, which have no `modelValue` prop
		MyInput: new () => { $props: { value?: string | number } };
		MySwitch: new () => { $props: { checked?: boolean } };
	}
}

declare const FRadioField: new () => { $props: { modelValue?: number } };
declare const Checked: new () => {
	$props: { modelValue?: string | number };
	$emit: (event: 'update:modelValue', value: string | number) => void;
};

declare const bool: boolean;
declare const str: string;
declare const numOrStr: string | number;
</script>

<template>
	<my-input v-model="numOrStr" />
	<MyInput v-model="numOrStr" />
	<!-- @vue-expect-error `value` is not a boolean -->
	<my-input v-model="bool" />
	<!-- @vue-expect-error `value` is written back as `string | number` -->
	<my-input v-model="str" />

	<my-switch v-model="bool" />
	<!-- @vue-expect-error `checked` is a boolean -->
	<MySwitch v-model="str" />

	<f-radio-field v-model="str" />

	<Checked v-model="numOrStr" />
	<!-- @vue-expect-error `update:modelValue` emits `string | number` -->
	<Checked v-model="str" />
</template>
