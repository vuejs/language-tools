<script setup lang="ts">
const foo = {};
</script>

<template>
	<!-- @vue-expect-error -->
	<div v-bind="foo"></div>
</template>
