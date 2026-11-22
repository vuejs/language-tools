<script setup lang="ts">
import Child from './child.vue';

const msg = 'hello';
</script>

<template>
	<!-- bindings of `<script setup>` with a `<script>` block after the template -->
	<Child url="https://example.com/0">{{ msg }}</Child>
	<Child url="https://example.com/1">{{ msg }}</Child>
</template>

<script lang="ts">
</script>
