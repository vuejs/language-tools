<script setup lang="ts">
import Child from './child.vue';
</script>

<template>
	<!-- should report TS2345: `foo` is required -->
	<Child :bar="1" />
	<Child v-bind="{ bar: 1 }" />
	<Child foo="x" :bar="1" />
</template>
