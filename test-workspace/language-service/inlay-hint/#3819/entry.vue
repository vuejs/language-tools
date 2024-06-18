<script setup lang="ts">
import Comp from './Comp.vue';
</script>

<template>
  <Comp>
    <template #a-b="s"></template>
    <template #ab="s"></template>
    <template #c-d="s"></template>
    <template #cd="s"></template>
  </Comp>
</template>
