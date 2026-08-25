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

	<!-- type guard: typeof -->
	<div>{{ typeof strOrNum === 'string' && exactType(strOrNum, {} as string) }}</div>

	<!-- type guard: instanceof -->
	<div>{{ dateOrStr instanceof Date && exactType(dateOrStr, {} as Date) }}</div>

	<!-- type guard: in -->
	<div>{{ 'a' in objUnion && exactType(objUnion, {} as { kind: 'a'; a: number }) }}</div>

	<!-- type guard: === -->
	<div>{{ aOrB === 'a' && exactType(aOrB, {} as 'a') }}</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { exactType } from '../shared';

function handler(_e: Event) {}
const count = ref(0);
const strOrNum = ref<string | number>('');
const dateOrStr = ref<unknown>(new Date());
const objUnion = ref<{ kind: 'a'; a: number } | { kind: 'b'; b: string }>({ kind: 'a', a: 1 });
const aOrB = ref<'a' | 'b'>('a');
</script>
