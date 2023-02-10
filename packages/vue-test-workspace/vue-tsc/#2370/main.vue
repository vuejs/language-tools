<script setup lang="ts">
defineProps<{
	msg: string
}>()

defineEmits<{}>()
</script>

<template>
	<div>{{ msg }}</div>
</template>
