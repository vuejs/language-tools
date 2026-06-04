<script setup lang="ts">
defineSlots<{
	default?: (props: { ariaDescribedby: string }) => any;
}>()
</script>

<template>
	<slot aria-describedby="bar" />
</template>
