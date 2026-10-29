<script setup lang="ts">
import { computed, type MaybeRef } from 'vue';
import { Status } from './status';

declare function getValue(): MaybeRef<string | undefined>;
const maybe = getValue();
const readonlyValue = computed(() => 'value');
const rows: { meta?: { id: number } }[] = [];
const pages: (number | 'ellipsis')[] = [];
const select = (id: number) => id;
</script>

<template>
	<div>
		<!-- @vue-expect-error -->
		{{ maybe.toUpperCase() }}
	</div>
	<div v-if="maybe">
		<!-- @vue-expect-error -->
		{{ maybe.doesNotExist }}
	</div>
	<div v-if="readonlyValue">
		<!-- @vue-expect-error -->
		<button @click="readonlyValue = 'changed'" />
	</div>
	<template v-for="row in rows">
		<button v-if="row.meta" @click="select(row.meta.id)" />
	</template>
	<template v-for="page in pages">
		<span v-if="page === 'ellipsis'" />
		<button v-else @click="select(page)" />
	</template>
	<!-- @vue-ignore -->
	{{ Status.Active }}
	<div v-if="Status.Active">{{ Status.Active }}</div>
</template>
