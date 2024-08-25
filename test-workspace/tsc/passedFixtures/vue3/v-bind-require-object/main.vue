<script setup lang="ts">
const foo = 1;
</script>

<template>
	<!-- @vue-expect-error -->
	<div v-bind="foo"></div>
</template>
