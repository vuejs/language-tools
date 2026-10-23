<script setup>
defineProps({ label: { type: String, required: true } });
</script>

<template>
	<span>{{ label }}</span>
</template>
