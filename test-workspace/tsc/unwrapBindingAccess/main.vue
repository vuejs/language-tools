<template>
	<!-- function binding: read, should NOT get `.value` -->
	<button @click="handler"></button>
	<div>{{ exactType(handler, {} as (_e: Event) => void) }}</div>

	<!-- ref binding: read -->
	<div>{{ exactType(count, {} as number) }}</div>

	<!-- ref binding: narrowing (v-if) -->
	<div v-if="count">{{ exactType(count, {} as number) }}</div>

	<!-- ref binding: narrowing (ternary) -->
	<div>{{ count ? count : 0 }}</div>

	<!-- ref binding: write (v-model) -->
	<input v-model="count" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { exactType } from '../shared';

function handler(_e: Event) {}
const count = ref(0);
</script>
