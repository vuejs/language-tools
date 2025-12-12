<script setup lang="ts">
import child from './child.vue';

defineProps<{
	bar: number;
}>();
</script>

<template>
	<child bar="bar" />
</template>
