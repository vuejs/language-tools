<script setup lang="ts">
withDefaults(defineProps<{
	/** The label */
	label?: string;
}>(), {
	label: 'hello',
});
defineEmits<{
	change: [value: number];
}>();
</script>

<template>
	<div>{{ label }}</div>
</template>
