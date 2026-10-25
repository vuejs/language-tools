<script setup lang="ts">
const foo = 1;
const bar = 2;
const color = 'red';
</script>

<template>
	<div :class="foo">{{ bar }}</div>
</template>

<style scoped>
.item {
	color: v-bind(color);
}
</style>
