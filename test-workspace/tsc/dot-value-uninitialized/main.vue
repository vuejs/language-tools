<script setup lang="ts">
import { exactType } from '../shared';

let count: number;
let label: string | undefined;
setTimeout(() => {
	count = 1;
	label = 'a';
});
</script>

<template>
	<div v-if="count">{{ exactType(count, {} as number) }}</div>
	<div v-if="label">{{ exactType(label, {} as string) }}</div>
	<button @click="label && exactType(label, {} as string)"></button>
</template>
