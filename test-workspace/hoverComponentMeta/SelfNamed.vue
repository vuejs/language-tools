<script setup lang="ts">
defineOptions({ name: 'Named' });
defineProps<{
	/** The named label */
	label?: string;
}>();
</script>

<template>
	<Named v-if="false" />
</template>
