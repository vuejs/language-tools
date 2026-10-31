<script setup lang="ts">
defineProps<{
	pages: (number | 'dots')[];
	selected: { id: string } | null;
	action?: () => void;
}>();
</script>

<template>
	<div v-for="page in pages" :key="page">
		<span v-if="page === 'dots'">...</span>
		<button v-else @click="page.toUpperCase()">Invalid handler</button>
	</div>
	<button v-if="selected.id" @click="selected.id.toFixed()">Invalid condition and handler</button>
	<button v-if="action" @click="action(123)">Invalid argument</button>
</template>
