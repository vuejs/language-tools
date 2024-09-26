<script setup lang="ts" generic="T">
import child from './child.vue';

defineProps<{
	foo?: T;
}>();
</script>

<template>
	<child />
</template>
