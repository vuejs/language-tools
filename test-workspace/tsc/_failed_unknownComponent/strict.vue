<!-- @strictTemplates true -->

<script setup lang="ts">
import Child from './child.vue';
</script>

<template>
	<UnknownWidget />
	<unknown-widget />
	<Child foo="ok" />
</template>
