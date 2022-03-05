<template>{{ count }}</template>

<script setup lang="ts">
defineEmits<{
    (e: "a" | "b", a: string): void;
}>();

const count = 0;
</script>
