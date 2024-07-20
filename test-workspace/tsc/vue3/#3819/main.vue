<script setup>
import Comp from './comp.vue';

const config = {
	a: 'a',
	b: 'b',
	c: 'c',
	d: 'd',
};
</script>

<template>
	<Comp :config="config">
		<template #last-columns></template>
		<!-- @vue-expect-error -->
		<template #last-columnsasd></template>
		<template #lastColumns></template>
		<!-- @vue-expect-error -->
		<template #lastColumnsasd></template>
	</Comp>
</template>
