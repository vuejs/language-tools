<script setup lang="ts">
import UnionHolder from './UnionHolder.vue';
import Item from './Item.vue';
import Other from './Other.vue';
import PairWrapper from './PairWrapper.vue';
import Container from './Container.vue';
defineProps<{
	ok: boolean;
	value: string | number;
	component: typeof Item<number> | typeof Other;
	unknownComponent: typeof Item<number> | typeof Container;
}>();
</script>
<template>
	<UnionHolder><Item :value="1" /><Other other="yes" /><PairWrapper /></UnionHolder>
	<UnionHolder><component :is="component" :value="1" other="yes" /></UnionHolder>
	<!-- @vue-expect-error -->
	<UnionHolder><component :is="unknownComponent" :value="1" /></UnionHolder>
	<UnionHolder><Item v-if="ok" :value="1" /><Other v-else other="yes" /></UnionHolder>
	<!-- @vue-expect-error -->
	<UnionHolder><Item value="wrong" /></UnionHolder>
	<!-- @vue-expect-error -->
	<UnionHolder><Container /></UnionHolder>
	<UnionHolder>
		<template #separate><Item :value="1" /><Other other="yes" /></template>
		<template #homogeneous><Item :value="1" /><Item :value="2" /></template>
		<template #single><Other other="yes" /></template>
		<template #nullable><Item v-if="ok" :value="1" /></template>
		<template #tuple><Item :value="1" /><Other other="yes" /></template>
		<template #generic><Item :value="value" /><Item :value="1" /><Item value="yes" /></template>
		<template #native><input /><button /></template>
	</UnionHolder>
	<UnionHolder>
		<template #homogeneous><Other other="yes" /><Other other="yes" /></template>
		<template #tuple><Other other="yes" /><Item :value="1" /></template>
	</UnionHolder>
	<UnionHolder>
		<!-- @vue-expect-error -->
		<template #separate><Item :value="false" /></template>
		<!-- @vue-expect-error -->
		<template #homogeneous><Item :value="1" /><Other other="yes" /></template>
		<!-- @vue-expect-error -->
		<template #single><Item :value="1" /><Other other="yes" /></template>
		<!-- @vue-expect-error -->
		<template #nullable><input /></template>
		<!-- @vue-expect-error -->
		<template #tuple><Item :value="1" /><Item :value="2" /></template>
		<!-- @vue-expect-error -->
		<template #generic><Item :value="false" /></template>
		<!-- @vue-expect-error -->
		<template #native><textarea /></template>
		<!-- @vue-expect-error -->
		<template #constrained><Item value="wrong" other="yes" /></template>
	</UnionHolder>
	<UnionHolder>
		<!-- @vue-expect-error -->
		<template #homogeneous><Item v-if="ok" :value="1" /><Other v-else other="yes" /><Item :value="2" /></template>
	</UnionHolder>
</template>
