<script setup lang="ts">
import { exactType } from '../shared';
import Child from './child.vue';
import { KEYS } from './keys';

const fallback = { item: '' };
</script>

<template>
	<Child>
		<template #foo="props = { item: '' }">{{ exactType(props.item, {} as string) }}</template>
		<template #bar>{{ KEYS.BAR }}</template>
	</Child>
	<Child>
		<template #foo="props = fallback">{{ exactType(props.item, {} as string) }}</template>
	</Child>
</template>
