<template>
	<div>{{ opened }}</div>
</template>

<script setup lang="ts">
const opened = defineModel<boolean>('opened', {
	required: true,
})
</script>
