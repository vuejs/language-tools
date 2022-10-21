<template>{{ count }}</template>

<script setup lang="ts">
const count = 0;
</script>

<script lang="ts">
export function logCount() {
    // @ts-expect-error
    console.log(count);
}
</script>
