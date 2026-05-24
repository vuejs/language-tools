<script setup lang="ts">
/**
 * Component without explicit name
 */
defineProps<{
	/**
	 * The value prop
	 */
	value: string;
}>();
</script>

<template>
	<div>{{ value }}</div>
</template>
