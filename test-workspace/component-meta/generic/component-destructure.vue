<script setup lang="ts" generic="T">
const { foo = 1, bar, 'foo-bar': fooBar = [2] } = defineProps<{ foo?: number; bar?: T; 'foo-bar'?: number[] }>();
defineModel<string>('title', { default: () => 'x' });
</script>

<template>{{ foo }} {{ bar }} {{ fooBar }}</template>
