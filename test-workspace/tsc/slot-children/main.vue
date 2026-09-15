<script setup lang="ts">
import Parent from './Parent.vue';
import Item from './Item.vue';
import Other from './Other.vue';
import Wrapper from './Wrapper.vue';
defineProps<{ ok: boolean; values: number[] }>();
</script>

<template>
	<Parent :value="1"><Item :value="1" /></Parent>
	<Parent :value="1"><Wrapper :value="1" /></Parent>
	<Parent :value="1"><Item v-for="value in values" :value="value" /></Parent>
	<Parent :value="1"><Item v-if="ok" :value="1" /></Parent>
	<Parent :value="1"><template v-if="ok"><Item :value="1" /><Item :value="2" /></template><Item v-else :value="3" /></Parent>
	<!-- @vue-expect-error -->
	<Parent :value="1"><Item value="wrong" /></Parent>
	<!-- @vue-expect-error -->
	<Parent :value="1"><Other other="wrong" /></Parent>
	<!-- @vue-expect-error -->
	<Parent :value="1"><input /></Parent>
	<!-- @vue-expect-error -->
	<Parent :value="1">unexpected text</Parent>
	<!-- @vue-expect-error -->
	<Parent :value="1"><Wrapper value="wrong" /></Parent>
	<Parent :value="1">
		<template #input><input /></template>
		<template #pair><input /><button /></template>
		<template #text>hello {{ 1 }}</template>
		<template #empty><!-- comment --></template>
		<template #props><Item :value="1" /></template>
		<template #exact><Item :value="1" /></template>
		<template #optional><input v-if="ok" /></template>
		<template #any><Other other="anything" /> text <div /></template>
	</Parent>
	<Parent :value="1">
		<!-- @vue-expect-error -->
		<template #input><button /></template>
		<!-- @vue-expect-error -->
		<template #pair><input /></template>
		<!-- @vue-expect-error -->
		<template #text><input /></template>
		<!-- @vue-expect-error -->
		<template #empty>text</template>
		<!-- @vue-expect-error -->
		<template #props><Item value="wrong" /></template>
		<!-- @vue-expect-error -->
		<template #exact><Other other="wrong" /></template>
	</Parent>
</template>
