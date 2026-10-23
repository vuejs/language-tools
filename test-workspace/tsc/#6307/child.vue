<script setup lang="ts" generic="T">
defineProps<{ value: T }>();
defineEmits<{ select: [value: T] }>();
</script>

<template>
	<div />
</template>
