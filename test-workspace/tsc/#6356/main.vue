<script setup lang="ts">
import { computed } from 'vue';

type Slot = { kind: 'page'; number: number } | { kind: 'gap'; key: string };

const slots = computed<Slot[]>(() => [{ kind: 'page', number: 1 }, { kind: 'gap', key: 'g' }]);

function go(page: number) {
	return page;
}
</script>

<template>
	<div v-for="slot in slots">
		<span v-if="slot.kind === 'gap'">{{ slot.key }}</span>
		<button v-else @click="go(slot.number)">{{ slot.number }}</button>
	</div>
	<div v-for="slot in slots">
		<span v-if="slot.kind === 'gap'" @click="go(slot.key.length)">{{ slot.key }}</span>
		<button v-else-if="slot.kind === 'page'" @click="go(slot.number)">{{ slot.number }}</button>
	</div>
</template>
