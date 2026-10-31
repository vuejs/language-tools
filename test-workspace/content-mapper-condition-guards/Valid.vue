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
		<button v-else @click="console.log(page)">{{ page }}</button>
	</div>
	<button v-if="selected" @click="console.log(selected.id)">Selected</button>
	<button v-if="action" @click="action()">Action</button>
</template>
