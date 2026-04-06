<script lang="ts" setup>
const {
	label = 'こんにちは'
} = defineProps<{
	label?: string;
}>();
</script>

<template>
	<div>{{ label }}</div>
</template>
