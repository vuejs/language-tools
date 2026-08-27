<script setup lang="ts">
defineProps<{ msg?: string }>();
defineSlots<{ default(props: { shadowed: number }): any }>();
</script>

<template>
	<div>{{ msg }}</div>
	<slot :shadowed="1" />
</template>
