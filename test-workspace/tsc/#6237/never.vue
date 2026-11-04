<script setup lang="ts">
const props = defineProps<{ value: never }>();
const value = props.value;
</script>

<template>
	{{ value }}
</template>
