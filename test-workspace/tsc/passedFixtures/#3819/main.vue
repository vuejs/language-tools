<script setup>
import Comp from './component.vue';

const config = {
	a: 'a',
	b: 'b',
	c: 'c',
	d: 'd',
}
</script>

<template>
	<Comp :config="config">
		<template #last-columns></template>
		<!-- @vue-expect-error -->
		<template #last-columnsasd></template> <!-- should be error  -->
		<template #lastColumns></template>
		<!-- @vue-expect-error -->
		<template #lastColumnsasd></template>
	</Comp>
</template>
