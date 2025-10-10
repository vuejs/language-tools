<script setup lang="ts" generic="T">
import child from './child.vue';

defineProps<{
	bar?: T;
}>();
</script>

<template>
	<child :foo="bar" />
</template>
