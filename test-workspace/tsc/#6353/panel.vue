<script setup lang="ts">
import Child from './child.vue';

defineProps<{
	panelId: string;
	page?: boolean;
}>();
</script>

<template>
	<component :is="page ? 'section' : Child" />
</template>
