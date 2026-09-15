<script setup lang="ts">
defineProps<{ depth: number }>();
</script>
<template><Recursive v-if="depth" :depth="depth - 1" /></template>
