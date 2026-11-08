<script setup lang="ts" generic="T extends string | number = string">
defineProps<{
	options: T[];
	filter?: (option: T) => boolean;
}>();
</script>

<template>
	<div />
</template>
