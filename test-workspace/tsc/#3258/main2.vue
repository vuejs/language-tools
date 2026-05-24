<script setup lang="ts">
import { ref } from 'vue';

const x = ref(0);
</script>

<template>
	<button @click="() => {
		const x = 1;
		x
	}"></button>
	<button @click="() => {
		x.toFixed(); // should unwrap
	}"></button>
</template>