<template>
	<input v-model="selection" :value="1" :type="type" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
withDefaults(
	defineProps<{
		type?: 'checkbox' | 'radio';
	}>(),
	{
		type: 'checkbox',
	}
);
const defaultSelection: string[] = [];
const selection = ref<string[]>(defaultSelection);
</script>
