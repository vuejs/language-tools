<template>
	<div>{{ opened }}</div>
</template>

<script setup lang="ts">
const opened = defineModel('opened', {
	type: Boolean,
	required: true,
})
</script>
