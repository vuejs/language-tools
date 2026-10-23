<script setup lang="ts" generic="T extends string | number">
defineProps<{ value: T }>();
defineEmits<{ update: [v: T] }>();
</script>

<template>
	<div />
</template>
