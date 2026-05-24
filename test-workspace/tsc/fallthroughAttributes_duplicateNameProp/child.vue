<script setup lang="ts">
import basic from './basic.vue';

defineProps<{
	bar: number;
}>();
</script>

<template>
	<basic bar="bar" />
</template>
