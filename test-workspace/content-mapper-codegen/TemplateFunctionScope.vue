<script setup lang="ts">
import { onMounted, ref } from 'vue';

let chart: { name: string } | null = null;
let mode: 'view' | 'edit' = 'view';
let draft: string | undefined;
const status = ref<'uploading' | 'uploaded' | 'error'>('uploading');
status.value = 'uploading';
onMounted(() => {
	chart = { name: 'x' };
	mode = 'edit';
	draft = '';
	status.value = 'error';
});
</script>

<template>
	<div v-if="chart">{{ chart.name }}</div>
	<div v-else :title="draft?.length.toFixed()" />
	<button v-if="mode === 'edit'" />
	<span v-if="status === 'error'">Upload failed</span>
	<!-- @vue-expect-error -->
	{{ chart?.missing }}
</template>
