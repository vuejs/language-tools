<script setup lang="ts">
import { exactType } from '../shared';
import Child from './child.vue';
</script>

<template>
	<Child>
		<template #default="{ num }">{{ exactType(num, {} as number) }}</template>
		<template #named="{ str }">{{ exactType(str, {} as string) }}</template>
		<template #foo="{ bool }">{{ exactType(bool, {} as boolean) }}</template>
		<template #bar="{ bool }">{{ exactType(bool, {} as boolean) }}</template>
	</Child>
</template>
