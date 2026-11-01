<script setup>
const { a = 1, d } = defineProps({ a: Number, d: Number });
const m = defineModel({ type: Number, default: 1 });
</script>

<template>
	{{ a }}{{ d }}{{ m }}
</template>
