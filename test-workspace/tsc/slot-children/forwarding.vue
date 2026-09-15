<script setup lang="ts">
import Basic from './Basic.vue';
import UnknownForwarder from './UnknownForwarder.vue';
import NamedForwarder from './NamedForwarder.vue';
import NestedForwarder from './NestedForwarder.vue';
import Item from './Item.vue';
defineProps<{ ok: boolean; values: number[] }>();
</script>
<template>
	<Basic>
		<template #input><UnknownForwarder /></template>
		<template #inputs><UnknownForwarder><input /><input /></UnknownForwarder></template>
		<template #pair><UnknownForwarder><Item :value="1" /><Item :value="2" /></UnknownForwarder></template>
	</Basic>
	<Basic>
		<template #input><NestedForwarder><input /></NestedForwarder></template>
		<template #inputs><UnknownForwarder><UnknownForwarder><input /></UnknownForwarder></UnknownForwarder></template>
	</Basic>
	<Basic>
		<template #input><UnknownForwarder><template #default /></UnknownForwarder></template>
		<template #inputs><UnknownForwarder><input v-if="ok" /></UnknownForwarder></template>
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #pair><UnknownForwarder><Item v-if="ok" :value="1" /></UnknownForwarder></template>
	</Basic>
	<Basic>
		<template #input><NamedForwarder><template #header><input /></template></NamedForwarder></template>
	</Basic>
	<Basic>
		<template #inputs><NamedForwarder><template v-if="ok" #header><input /></template></NamedForwarder></template>
	</Basic>
	<Basic>
		<template #input><NamedForwarder><template v-if="ok" #header><input /></template><template v-else #header><input /></template></NamedForwarder></template>
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #input><NestedForwarder><button /></NestedForwarder></template>
		<!-- @vue-expect-error -->
		<template #pair><UnknownForwarder><Item :value="1" /></UnknownForwarder></template>
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #input><NamedForwarder /></template>
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #input><NamedForwarder><template v-if="ok" #header><input /></template></NamedForwarder></template>
	</Basic>
</template>
