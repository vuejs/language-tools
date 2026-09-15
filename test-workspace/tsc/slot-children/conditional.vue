<script setup lang="ts">
import Basic from './Basic.vue';
import Item from './Item.vue';
import Other from './Other.vue';
import Parent from './Parent.vue';
import UnionHolder from './UnionHolder.vue';
import RequiredNamed from './RequiredNamed.vue';
import UnknownForwarder from './UnknownForwarder.vue';
defineProps<{
	mode: 'first' | 'second' | 'third';
	model: { kind: 'number'; value: number } | { kind: 'string'; value: string };
	values: number[];
}>();
</script>
<template>
	<Basic>
		<template #single><Item v-if="mode === 'first'" :value="1" /><Item v-else-if="mode === 'second'" :value="2" /><Item v-else :value="3" /></template>
		<template #pair><template v-if="mode === 'first'"><Item :value="1" /><Item :value="2" /></template><template v-else><Item :value="3" /><Item :value="4" /></template></template>
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #single><Item v-if="mode === 'first'" :value="1" /><Other v-else-if="mode === 'second'" other="wrong" /><Item v-else :value="3" /></template>
		<!-- @vue-expect-error -->
		<template #single><Item v-if="mode === 'first'" :value="1" /><Item v-else-if="mode === 'second'" :value="2" /></template>
		<!-- @vue-expect-error -->
		<template #pair><template v-if="mode === 'first'"><Item :value="1" /><Item :value="2" /></template><Item v-else :value="3" /></template>
	</Basic>
	<template v-if="model.kind === 'number'">
		<Parent :value="model.value"><Item :value="model.value" /></Parent>
		<!-- @vue-expect-error -->
		<Parent :value="model.value"><Item value="wrong" /></Parent>
	</template>
	<template v-else>
		<Parent :value="model.value"><Item :value="model.value" /></Parent>
		<!-- @vue-expect-error -->
		<Parent :value="model.value"><Item :value="1" /></Parent>
	</template>
	<UnionHolder>
		<template #generic><Item v-if="model.kind === 'number'" :value="model.value" /><Item v-else :value="model.value" /></template>
		<template #homogeneous><template v-if="mode === 'first'"><Item :value="1" /><Item :value="2" /></template><template v-else><Other other="yes" /><Other other="yes" /></template></template>
	</UnionHolder>
	<Basic>
		<template #input><UnknownForwarder><input v-if="mode === 'first'" /></UnknownForwarder></template>
		<!-- @vue-expect-error -->
		<template #input><UnknownForwarder><button v-if="mode === 'first'" /></UnknownForwarder></template>
	</Basic>
	<RequiredNamed>
		<input />
		<template v-if="mode === 'first'" #header><button /></template>
		<template v-else-if="mode === 'second'" #header><button /></template>
		<template v-else #header><button /></template>
	</RequiredNamed>
	<Basic><Item v-for="value in values" v-if="mode === 'first'" :value="value" /><Item v-else :value="1" /></Basic>
	<!-- @vue-expect-error -->
	<Basic><Item v-for="value in values" v-if="mode === 'first'" :value="value" /><Other v-else other="wrong" /></Basic>
</template>
