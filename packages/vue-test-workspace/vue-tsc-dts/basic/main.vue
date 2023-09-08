<script setup lang="ts">
const props = defineProps<{
	name: string;
}>();
</script>

<template>
	<div>Hello {{ props.name }}</div>
</template>
