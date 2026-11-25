<script setup lang="ts">
const maybe = Math.random() ? 'a' : undefined;
</script>

<template>
	<div v-if="maybe">{{ maybe.length }}</div>
	{{ maybe.length }}
</template>
