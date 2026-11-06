<script setup>
defineProps({ text: { type: String, required: true } });
</script>

<template>
	<span>{{ text }}</span>
</template>
