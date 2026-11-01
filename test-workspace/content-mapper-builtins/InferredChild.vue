<script setup lang="ts">
defineProps({ title: { type: String, required: true }, size: { type: Number, default: 1 } });
defineEmits(['close']);
const open = defineModel<boolean>('open');
</script>

<template>
	<section :title="`${title} ${size}`" @click="$emit('close'), open = false">
		<slot name="head" :title="title" />
		<slot />
	</section>
</template>
