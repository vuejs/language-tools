<script setup lang="ts">
defineProps({ title: { type: String, required: true }, size: { type: Number, default: 1 } });
defineEmits(['close']);
</script>

<template>
	<section :title="`${title} ${size}`" @click="$emit('close')">
		<slot name="head" :title="title" />
		<slot />
	</section>
</template>
