<script setup lang="ts">
const props = defineProps<{ item: T }>();
const item: string = props.item;
</script>

<template>
	<div>{{ item }}</div>
</template>
