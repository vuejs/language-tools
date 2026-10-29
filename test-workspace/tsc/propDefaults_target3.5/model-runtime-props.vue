<script setup lang="ts">
const { a } = defineProps({ a: Number });
const m = defineModel<number>({ default: 1 });
const o = defineModel<number>('o');
</script>

<template>
	{{ a }}{{ m }}{{ o }}
</template>
