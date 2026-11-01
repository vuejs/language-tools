<script setup lang="ts">
const title = 'hello';
let count = 0;
const unused = 1;
const color = 'red';
</script>

<template>
	<div :title @click="count++">{{ title + count }}</div>
</template>

<style scoped>
.item {
	color: v-bind(color);
}
</style>
