<script setup lang="ts">
defineProps<{
	url?: string | RegExp;
	count?: number;
	format?: (value: number) => string;
	options?: { title?: string; onClose?: (event: Event) => void };
}>();
defineEmits<{ done: [value: number] }>();
defineModel<string>();
</script>

<template>
	<slot />
</template>
