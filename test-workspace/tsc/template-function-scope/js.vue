<script setup>
import { onMounted } from 'vue';

/** @type {{ name: string } | null} */
let chart = null;
/** @type {'view' | 'edit'} */
let mode = 'view';
onMounted(() => {
	chart = { name: 'x' };
	mode = 'edit';
});
</script>

<template>
	<div v-if="chart">{{ chart.name }}</div>
	<button v-if="mode === 'edit'" />
</template>
