<script setup lang="ts">
defineExpose({ x: 3 });
</script>

<template>
	{{ 
		// @ts-expect-error
		x
	}}
</template>
