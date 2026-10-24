<!-- TypeScript 7 drops `""` keys from `contentMappers[].options`, so this one is set per file -->
<!-- @vModelPropName { "": { "Unchecked": true } } -->

<script setup lang="ts">
declare const Checked: new () => { $props: { modelValue?: number } };
declare const Unchecked: new () => { $props: { modelValue?: number } };

declare const numOrStr: number | string;
</script>

<template>
	<!-- @vue-expect-error `modelValue` is a number -->
	<Checked v-model="numOrStr" />
	<Unchecked v-model="numOrStr" />
</template>
