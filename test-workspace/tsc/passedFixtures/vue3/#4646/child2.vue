<template>{{ other }}</template>

<script lang="ts" setup>
const other = defineModel<string | null>('other')
</script>
