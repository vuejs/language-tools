<script setup lang="ts" generic="T">
import basic from './basic.vue';

defineProps<{
	bar?: T;
}>();
</script>

<template>
	<basic :foo="bar" />
</template>
