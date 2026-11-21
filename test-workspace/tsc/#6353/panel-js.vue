<script setup>
import Child from './child.vue';

defineProps({
	panelId: { type: String, required: true },
	page: Boolean,
});
</script>

<template>
	<component :is="page ? 'section' : Child" />
</template>
