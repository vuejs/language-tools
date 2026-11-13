<script setup lang="ts">
const label = 'abc' as string;
function log(_n: number) {}
</script>

<template>
	<p>{{ log(label) }}</p>
	<p :title="String(log(label))">t</p>
	<button @click="log(label)">b</button>
</template>
