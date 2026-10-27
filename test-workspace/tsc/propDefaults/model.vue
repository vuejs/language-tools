<script setup lang="ts">
const m = defineModel<number>({ default: 1 });
const n = defineModel<string>('foo-bar', { default: 'x' });
const o = defineModel<number>('o');
</script>

<template>
	{{ m }}{{ n }}{{ o }}
</template>
