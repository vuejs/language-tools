<script setup lang="ts">
defineProps<{ modelValue?: unknown }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
	<input @change="emit('update:modelValue', 'typed text')" />
</template>
