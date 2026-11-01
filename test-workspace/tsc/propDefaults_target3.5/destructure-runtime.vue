<script setup lang="ts">
const { a = 1, d } = defineProps({ a: Number, d: Number });
</script>

<template>
	{{ a }}{{ d }}
</template>
